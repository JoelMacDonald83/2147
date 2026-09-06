const toyFunctionMemoryBlock = []

toyFunctionMemoryBlock[0] = { op: "set", address: 50, value: 5 }
toyFunctionMemoryBlock[1] = { op: "call", target: 4 }
toyFunctionMemoryBlock[2] = { op: "print", address: 50 }   // unreachable until return exists
toyFunctionMemoryBlock[3] = { op: "stop" }                 // unreachable too
toyFunctionMemoryBlock[4] = { op: "double", address: 50 }  // the function
toyFunctionMemoryBlock[5] = { op: "stop" }                 // temporary — return replaces this next lesson

const cpuRegisters = {
  memoryBlock: toyFunctionMemoryBlock,
  programCounter: 0,
  stackPointer: 90,
  running: true
}

const OPS = {
  set:    (step, cpuRegisters) => { cpuRegisters.memoryBlock[step.address] = step.value },
  double: (step, cpuRegisters) => { cpuRegisters.memoryBlock[step.address] = cpuRegisters.memoryBlock[step.address] * 2 },
  print:  (step, cpuRegisters) => { console.log("SCREEN:", cpuRegisters.memoryBlock[step.address]) },
  jump:(step, cpuRegisters)=>{
    cpuRegisters.programCounter = step.target
  },
  call: (step, cpuRegisters)=>{
    // the first step is call needs to write in a stackPointer the address to come back to, which will be the line that did the call + 1, given the programCounter is already set to the line that had call + 1, we just write the programCounter in the stackPointer
    cpuRegisters.memoryBlock[cpuRegisters.stackPointer] = cpuRegisters.proogramCounter
    // 
    cpuRegisters.stackPointer += 1

  },
  stop: (step, cpuRegisters) => { cpuRegisters.running = false }
}

const controlUnit = (cpuRegisters) => {
  while (cpuRegisters.running) {
    const step = cpuRegisters.memoryBlock[cpuRegisters.programCounter]
    cpuRegisters.programCounter += 1
    OPS[step.op](step, cpuRegisters)
  }
}

controlUnit(cpuRegisters)