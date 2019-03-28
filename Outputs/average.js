function average(A[N]) {
    return F1(A,N,0,1);
}
function F1(A,N,s,i) {
    return (i<=N) ? F1(A,N,s + A_{i},i+1) : s / N;
}
