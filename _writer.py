import os
def w(n,c):
    with open(n,"w",newline="") as f:
        f.write(c)
    print(f"OK: {n} ({len(c)} bytes)\n")
