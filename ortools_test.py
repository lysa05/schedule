from ortools.sat.python import cp_model


def main():
    model = cp_model.CpModel()
    x = model.NewIntVar(0, 10, "x")
    y = model.NewIntVar(0, 10, "y")
    model.Add(x + y == 7)
    model.Maximize(x)

    solver = cp_model.CpSolver()
    result = solver.Solve(model)

    print("Status:", solver.StatusName(result))
    print("x =", solver.Value(x), "y =", solver.Value(y))


if __name__ == "__main__":
    main()
