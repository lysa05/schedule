const API_URL = "http://127.0.0.1:8000"; // IMPORTANT: Change this to your Render backend URL (e.g. https://scheduler-api.onrender.com) after deployment

// Default data (copy of data_scalable.json)
const DEFAULT_DATA = {
    "year": 2025,
    "month": 12,
    "full_time_hours": 184,
    "heavy_days": {
        "15": { "extra_staff": 2 },
        "24": { "extra_staff": 3 },
        "29": { "extra_staff": 1 }
    },
    "weights": {
        "work_hours": 1000,
        "day_shape": 80,
        "shift_cost": 5,
        "open_close_fairness": 3,
        "clopen": 15
    },
    "config": {
        "auto_staffing": true,
        "busy_weekends": true,
        "min_openers": 1,
        "min_closers": 1,
        "open_ratio": 0.4,
        "close_ratio": 0.4,
        "manager_roles": ["manager", "deputy", "supervisor"]
    },
    "closed_holidays": [25, 26],
    "open_holidays": [24],
    "special_days": {
        "24": { "close": "12:00", "staff": 2 },
        "31": { "close": "17:00", "staff": 3 }
    },
    "employees": [
        {
            "name": "Kuba",
            "role": "manager",
            "contract_type": 1.0,
            "unavailable_days": [6, 7, 20, 21],
            "vacation_days": []
        },
        {
            "name": "Andrii",
            "role": "deputy",
            "contract_type": 1.0,
            "unavailable_days": [13, 14, 27, 28],
            "vacation_days": []
        },
        {
            "name": "Almaz",
            "role": "supervisor",
            "contract_type": 1.0,
            "unavailable_days": [1, 8, 15, 22, 29],
            "vacation_days": []
        },
        {
            "name": "Misa",
            "role": "staff",
            "contract_type": 0.5,
            "unavailable_days": [2, 3, 9, 10, 16, 17, 23, 30],
            "vacation_days": [29, 30, 31]
        },
        {
            "name": "Alenka",
            "role": "staff",
            "contract_type": 0.5,
            "unavailable_days": [4, 5, 11, 12, 18, 19],
            "vacation_days": []
        },
        {
            "name": "Aleska",
            "role": "staff",
            "contract_type": 0.75,
            "unavailable_days": [6, 13, 20, 27],
            "vacation_days": []
        },
        {
            "name": "Danik",
            "role": "staff",
            "contract_type": 0.75,
            "unavailable_days": [7, 14, 21, 28],
            "vacation_days": []
        }
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    const jsonInput = document.getElementById('jsonInput');
    const generateBtn = document.getElementById('generateBtn');
    const statusIndicator = document.getElementById('statusIndicator');
    const scheduleContainer = document.getElementById('scheduleContainer');
    const statsContainer = document.getElementById('statsContainer');

    // Initialize JSON input
    jsonInput.value = JSON.stringify(DEFAULT_DATA, null, 4);

    generateBtn.addEventListener('click', async () => {
        statusIndicator.textContent = "Generating...";
        statusIndicator.style.color = "var(--text-secondary)";
        generateBtn.disabled = true;

        try {
            const data = JSON.parse(jsonInput.value);

            const response = await fetch(`${API_URL}/solve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Failed to generate schedule");
            }

            const result = await response.json();

            if (result.status === "OPTIMAL" || result.status === "FEASIBLE") {
                renderSchedule(result, data);
                renderStats(result);
                statusIndicator.textContent = `Success (${result.status})`;
                statusIndicator.style.color = "var(--success)";
            } else {
                statusIndicator.textContent = `Failed: ${result.status}`;
                statusIndicator.style.color = "var(--error)";
                scheduleContainer.innerHTML = `<div class="placeholder-text">No solution found. Status: ${result.status}</div>`;
            }

        } catch (error) {
            console.error(error);
            statusIndicator.textContent = `Error: ${error.message}`;
            statusIndicator.style.color = "var(--error)";
            alert(`Error: ${error.message}`);
        } finally {
            generateBtn.disabled = false;
        }
    });
});

function renderSchedule(result, inputData) {
    const schedule = result.schedule;
    const employees = inputData.employees;
    const numDays = new Date(inputData.year, inputData.month, 0).getDate();
    const closedHolidays = new Set(inputData.closed_holidays || []);

    let html = '<table><thead><tr><th>Day</th>';
    employees.forEach(emp => {
        html += `<th>${emp.name}</th>`;
    });
    html += '</tr></thead><tbody>';

    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let day = 1; day <= numDays; day++) {
        const date = new Date(inputData.year, inputData.month - 1, day);
        const dayName = daysOfWeek[date.getDay() === 0 ? 6 : date.getDay() - 1]; // Fix JS Sunday=0

        html += `<tr><td>${day} ${dayName}</td>`;

        employees.forEach(emp => {
            const empName = emp.name;
            let cellContent = '';
            let cellClass = '';

            // Check holidays/vacations first
            if (closedHolidays.has(day)) {
                cellContent = 'HOL';
                cellClass = 'shift-HOL';
            } else if (emp.vacation_days && emp.vacation_days.includes(day)) {
                cellContent = 'VAC';
                cellClass = 'shift-VAC';
            } else if (emp.unavailable_days && emp.unavailable_days.includes(day)) {
                cellContent = 'x';
                cellClass = 'shift-x';
            } else {
                // Check schedule
                const daySchedule = schedule[day.toString()];
                if (daySchedule && daySchedule[empName]) {
                    const shift = daySchedule[empName];
                    cellContent = `${shift.start}-${shift.end}`;
                    cellClass = `shift-${shift.type}`;
                } else {
                    cellContent = '-';
                    cellClass = 'shift-x';
                }
            }

            html += `<td><span class="shift-cell ${cellClass}">${cellContent}</span></td>`;
        });

        html += '</tr>';
    }

    html += '</tbody></table>';
    document.getElementById('scheduleContainer').innerHTML = html;
}

function renderStats(result) {
    const statsContainer = document.getElementById('statsContainer');
    statsContainer.innerHTML = '';

    result.employees.forEach(emp => {
        const card = document.createElement('div');
        card.className = 'stat-card';
        card.innerHTML = `
            <div class="stat-header">${emp.name}</div>
            <div class="stat-value">${emp.total.toFixed(1)}h / ${emp.target}h</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">
                Diff: ${emp.diff > 0 ? '+' : ''}${emp.diff.toFixed(1)} | O:${emp.opens} C:${emp.closes} M:${emp.middle}
            </div>
        `;
        statsContainer.appendChild(card);
    });
}
