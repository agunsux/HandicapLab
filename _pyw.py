import os
p="src/lib/execution"
os.makedirs(p,exist_ok=True)
def w(n,c):
    with open(os.path.join(p,n),"w",newline="\n") as f:
        f.write(c)
    print(f"Wrote {n} ({len(c)} bytes)")
print("ready")
