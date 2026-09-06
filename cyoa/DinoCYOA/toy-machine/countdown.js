const countUp = (n) => {
  if(n===0){
    console.log("Liftoff!")
    return
  }
  countUp(n-1)
  console.log(n)
}
countUp(5)