function selectionSort(A[N]) {
    return F1(A,N,0,m,j,t);
}
function F1(A,N,i,m,j,t) {
    return (i < N) ? F2(A,N,i,i,i+1,t) : A;
}
function F2(A,N,i,m,j,t) {
    return (j < N) ? (A_{j} < A_{m}) ? F2(A,N,i,j,j+1,t) : F2(A,N,i,m,j+1,t) : (i != m) ? F1( | |A + \delta_{N}(i)(A_{m} -  |A + \delta_{N}(i)(A_{m} - A_{i})| _{i})|  + \delta_{N}(m)(A_{i} - A_{m})| ,N,i+1,m,j,A_{i}) : F1(A,N,i+1,m,j,t);
}
