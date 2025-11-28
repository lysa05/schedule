from ortools.sat.python import cp_model

def main():
    model = cp_model.CpModel()
    x = model.NewIntVar(0, 10, 'x')
    model.Add(x >= 5)
    solver = cp_model.CpSolver()
    status = solver.Solve(model)
    print(f"Status: {solver.StatusName(status)}")
    print(f"x = {solver.Value(x)}")

if __name__ == "__main__":
    main()
