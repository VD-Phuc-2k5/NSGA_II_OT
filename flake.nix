{
  description = "NSGAII Doctor Scheduling System - Development Environment";
  
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
    flake-utils.url = "github:numtide/flake-utils";
  };
  
  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };

        # Python environment with all required packages
        pythonEnv = pkgs.python312.withPackages (ps: with ps; [
          # Backend API
          fastapi
          uvicorn
          pydantic
          pydantic-settings

          # Data science & ML
          numpy
          pandas
          scipy
          scikit-learn
          
          # Visualization
          matplotlib
          seaborn
          
          # NSGA-II & Optimization
          pymoo
          
          # Utilities
          tabulate
          python-dateutil
        ]);
      in {
        devShells.default = pkgs.mkShell {
          name = "nsgaii-dev";
          
          buildInputs = [
            # Node.js for frontend
            pkgs.nodejs_24
            
            # Python environment
            pythonEnv
            
            # Tools
            pkgs.git
            pkgs.curl
            pkgs.which
            
            # Optional: For better development experience
            pkgs.direnv
          ];
          
          shellHook = ''
            echo "=========================================="
            echo "NSGAII Doctor Scheduling System"
            echo "=========================================="
            echo ""
            echo "Environment Information:"
            echo "Node version:"
            node --version
            echo "Python version:"
            python --version
            echo "Git version:"
            git --version
            echo ""
            echo "Python Packages:"
            python -c "import fastapi; print(f'  ✓ FastAPI: {fastapi.__version__}')"
            python -c "import pydantic; print(f'  ✓ Pydantic: {pydantic.__version__}')"
            python -c "import numpy; print(f'  ✓ NumPy: {numpy.__version__}')"
            python -c "import pandas; print(f'  ✓ Pandas: {pandas.__version__}')"
            echo ""
            echo "Usage:"
            echo "  Server: cd server && python -m uvicorn app.main:app --reload"
            echo "  Client: cd client && yarn install && yarn dev"
            echo ""
            echo "=========================================="
          '';
        };
      });
}
