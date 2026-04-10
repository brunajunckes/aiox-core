ssh-keygen -t ed25519 -f ~/.ssh/github -N ""
  # Adicionar ~/.ssh/github.pub em GitHub → Settings → SSH Keys                                
  git remote set-url origin git@github.com:brunajunckes/aiox-core.git                          
  git push origin main -f  
