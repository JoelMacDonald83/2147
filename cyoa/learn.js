const countUp = (n) => {
  if(n > 10){
    return
  }
  console.log(n)
  countUp(++n)
} 
countUp(6)