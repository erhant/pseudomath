function someConstructs(a,b) {
    return F1(a,b,0);
}
function F1(a,b,i) {
    return (i<b) ? F1(b - 1,b,i+1) : W1(a,b,i);
}
function W1(a,b,i) {
    return (a < b) ? W1(a + 1,b,i) : (a < b) ? a : W2(a -1,b,i);
}
function W2(a,b,i) {
    return (a >= b && a != b) ? W2(a -1,b,i) : b;
}
