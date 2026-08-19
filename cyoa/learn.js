/* 


*/

function countdown(n) {
  if (n === 0) {                // ← THE BASE CASE: the stop rule
    console.log("Blast off!");  //    smallest doll: just answer,
    return;                     //    call NOBODY, pop immediately
  }
  console.log(n);               // do this round's little job
  countdown(n - 1);             // ← call MYSELF, one step smaller
}

countdown(3);