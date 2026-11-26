// CRC 算法验证：比对参考实现从 HCI 抓包提取的 DOT 命令帧 CRC 尾字节。
// 结论决定 ble/protocol.ts 中帧构建采用动态计算 CRC 还是 HCI 验证字面字节。
//
// 验证结论（2026-11-26，Node 24 实测）：
//   1. CRC-16/IBM(MSB, poly 0x8005, init 0xFFFF) 与 CRC-16/MODBUS 均不匹配写帧尾字节；
//      覆盖范围×字节序×init 变体枚举、以及全 poly 暴力枚举（利用同长 timer 三帧的
//      线性差值不变式 + 65536 poly × 2 init × 2 算法）均无解 => 尾字节不可推导。
//   2. 官方 App 读命令 CRC 一律填 00 00（6 条不同命令），结合文档 "CRC field reserved"，
//      判定秤不校验 CRC 字段。
//   => 实现策略：5 条 HCI 验证写命令用字面字节；读命令与其余写命令 CRC 填 00 00；
//      真机验证清单中标注，若有问题只调整 ble/protocol.ts 一处。
//
// 已知帧（来源 timemore-dot-v3-30.html，官方 App 对真实 DOT 的抓包，作者标注 12/12 验证）：
//   tare      A5 5A 03 0D 00 02 00 00 | 00 71
//   timerStart A5 5A 03 02 00 01 01    | 00 20
//   timerStop  A5 5A 03 02 00 01 02    | FF D0
//   timerReset A5 5A 03 02 00 01 03    | FF 81
//   keepalive  A5 5A 03 08 00 02 01 00 | 00 25
//   read 命令（13/08/05/02/06/0C）官方 App 一律发送尾字节 00 00

const frames = [
  ['tare       (exp 0x0071)', [0xa5, 0x5a, 0x03, 0x0d, 0x00, 0x02, 0x00, 0x00], 0x0071],
  ['timerStart (exp 0x0020)', [0xa5, 0x5a, 0x03, 0x02, 0x00, 0x01, 0x01], 0x0020],
  ['timerStop  (exp 0xffd0)', [0xa5, 0x5a, 0x03, 0x02, 0x00, 0x01, 0x02], 0xffd0],
  ['timerReset (exp 0xff81)', [0xa5, 0x5a, 0x03, 0x02, 0x00, 0x01, 0x03], 0xff81],
  ['keepalive  (exp 0x0025)', [0xa5, 0x5a, 0x03, 0x08, 0x00, 0x02, 0x01, 0x00], 0x0025],
  // 官方 App 读命令一律 CRC=0000（6 条不同命令全部为 0 → 说明 CRC 字段未启用）
  ['read02     (exp 0x0000)', [0xa5, 0x5a, 0x02, 0x02, 0x00, 0x00], 0x0000],
  ['read05     (exp 0x0000)', [0xa5, 0x5a, 0x02, 0x05, 0x00, 0x00], 0x0000],
  ['read13     (exp 0x0000)', [0xa5, 0x5a, 0x02, 0x13, 0x00, 0x00], 0x0000],
]

// CRC-16/IBM：文档声明 poly 0x8005、init 0xFFFF，未说明反射；MSB-first 即下方 ibmMsb
function crc16IbmMsb(bytes) {
  let crc = 0xffff
  for (const b of bytes) {
    crc ^= (b << 8) & 0xffff
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x8005) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc
}

// CRC-16/MODBUS：反射式 poly 0xA001、init 0xFFFF（参考实现用于 Link 型号的算法）
function crc16Modbus(bytes) {
  let crc = 0xffff
  for (const b of bytes) {
    crc ^= b
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1
    }
  }
  return crc
}

const hex = v => '0x' + v.toString(16).padStart(4, '0').toUpperCase()

console.log('帧'.padEnd(26), 'IBM-MSB'.padEnd(10), 'MODBUS'.padEnd(10), '期望')
let msbHit = 0
let mbHit = 0
for (const [name, data, exp] of frames) {
  const m = crc16IbmMsb(data)
  const b = crc16Modbus(data)
  if (m === exp) msbHit++
  if (b === exp) mbHit++
  console.log(
    name.padEnd(26),
    hex(m).padEnd(10),
    hex(b).padEnd(10),
    hex(exp),
    m === exp ? '<= MSB匹配' : '',
    b === exp ? '<= MODBUS匹配' : '',
  )
}
console.log()
console.log(`IBM-MSB 匹配 ${msbHit}/${frames.length}，MODBUS 匹配 ${mbHit}/${frames.length}`)
if (msbHit === frames.length) {
  console.log('结论：写帧动态计算 CRC-16/IBM(MSB, poly 0x8005, init 0xFFFF)；读帧官方恒 0000，CRC 字段未启用')
} else if (mbHit === frames.length) {
  console.log('结论：写帧动态计算 CRC-16/MODBUS；读帧官方恒 0000')
} else {
  console.log('结论：无算法匹配读帧 0000（官方 App 直接填零），CRC 字段未启用；写帧尾字节为固定观测值')
}
