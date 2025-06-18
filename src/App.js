import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  deleteField,
} from "firebase/firestore";
import { default as ReactSelect, components } from "react-select";

const Option = (props) => {
  return (
    <div>
      <components.Option {...props}>
        <input
          type="checkbox"
          checked={props.isSelected}
          onChange={() => null}
        />{" "}
        <label>{props.label}</label>
      </components.Option>
    </div>
  );
};

function App() {
  const [entries, setEntries] = useState([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [timePeriod, setTimePeriod] = useState("month");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedExtra, setSelectedExtra] = useState([]);
  const [chartMetric, setChartMetric] = useState("price");

  const options = [
    { value: "Little Animal", label: "Little Animal" },
    { value: "Big Animal", label: "Big Animal" },
    { value: "Complex Background", label: "Complex Background" },
    { value: "Detailed Prop", label: "Detailed Prop" },
    { value: "Commercial", label: "Commercial" },
    { value: "Rush", label: "Rush" },
    { value: "1 Added Character", label: "1 Added Character" },
    { value: "2 Added Characters", label: "2 Added Characters" },
    { value: "3 Added Characters", label: "3 Added Characters" },
    { value: "Rendered", label: "Rendered" },
    { value: "Sketch", label: "Sketch" },
    { value: "Chibi", label: "Chibi" },
  ];

  // Load entries from Firestore on initial render
  useEffect(() => {
    const fetchEntries = async () => {
      const entriesCollection = collection(db, "entries");
      const entriesSnapshot = await getDocs(entriesCollection);
      const entriesList = entriesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setEntries(entriesList);
    };

    fetchEntries();
  }, []);

  const addEntry = async () => {
    if (name && price && date) {
      const newEntry = {
        name,
        price: parseFloat(price),
        date: date,
        type: selectedType,
        extras: selectedExtra,
      };
      const docRef = await addDoc(collection(db, "entries"), newEntry);
      setEntries([...entries, { id: docRef.id, ...newEntry }]);
      setName("");
      setPrice("");
      setDate("");
      setSelectedType("");
      setSelectedExtra([]);
    }
  };

  const deleteEntry = async (id) => {
    await deleteDoc(doc(db, "entries", id));
    const updatedEntries = entries.filter((entry) => entry.id !== id);
    setEntries(updatedEntries);
  };

  const addTimeToEntry = async (id, time) => {
    const entryRef = doc(db, "entries", id);
    await updateDoc(entryRef, { time });
    setEntries((prevEntries) =>
      prevEntries.map((entry) => (entry.id === id ? { ...entry, time } : entry))
    );
  };

  const updateTimeForEntry = async (id, newTime) => {
    const entryRef = doc(db, "entries", id);

    // If the user enters "0", delete the time field
    const updatedData =
      newTime === "0" ? { time: deleteField() } : { time: newTime };

    await updateDoc(entryRef, updatedData);
    setEntries((prevEntries) =>
      prevEntries.map((entry) =>
        entry.id === id
          ? { ...entry, time: newTime === "0" ? undefined : newTime }
          : entry
      )
    );
  };

  const handleChange = (selected) => {
    setSelectedExtra(selected);
  };

  // Filter entries by selected year
  const filterEntriesByYear = (entries, year, month) => {
    if (!year && !month) return entries; // If no year and month are selected, return all entries
    return entries.filter(
      (entry) =>
        (year ? new Date(entry.date).getFullYear() === parseInt(year) : true) &&
        (month ? new Date(entry.date).getMonth() === parseInt(month) : true)
    );
  };

  const aggregateData = (entries, period) => {
    const aggregatedData = {};

    entries.forEach((entry) => {
      let periodKey;
      const date = new Date(entry.date);

      switch (period) {
        case "year":
          periodKey = date.getFullYear().toString();
          break;
        case "month":
          periodKey = date.toISOString().slice(0, 7); // YYYY-MM format
          break;
        case "week":
          const weekNumber = getWeekNumber(date);
          periodKey = `${date.getFullYear()}-W${weekNumber
            .toString()
            .padStart(2, "0")}`;
          break;
        default:
          periodKey = date.toISOString().slice(0, 10); // YYYY-MM-DD format
      }

      if (aggregatedData[periodKey]) {
        aggregatedData[periodKey].price += entry.price;
        aggregatedData[periodKey].type = entry.type;
        aggregatedData[periodKey].extras = entry.extras;
      } else {
        aggregatedData[periodKey] = {
          date: periodKey,
          price: entry.price,
          type: entry.type,
          extras: entry.extras,
        };
      }
    });

    // Sort the data based on the period key
    return Object.values(aggregatedData).sort((a, b) => {
      if (period === "week") {
        const [yearA, weekA] = a.date.split("-W");
        const [yearB, weekB] = b.date.split("-W");
        return (yearA - yearB) * 100 + (weekA - weekB);
      }
      return a.date.localeCompare(b.date);
    });
  };

  // Helper function to get week number
  const getWeekNumber = (date) => {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  };

  // Prepare aggregated data for the BarChart (grouped by month)
  const filteredEntries = filterEntriesByYear(
    entries,
    selectedYear,
    selectedMonth
  ).sort((a, b) => new Date(b.date) - new Date(a.date));

  const chartData = aggregateData(filteredEntries, timePeriod).map(
    (dataPoint) => {
      // Calculate wage per hour for this period
      let wagePerHour = null;
      // Find all entries in this period
      const periodEntries = filteredEntries.filter((entry) => {
        let periodKey;
        const date = new Date(entry.date);
        switch (timePeriod) {
          case "year":
            periodKey = date.getFullYear().toString();
            break;
          case "month":
            periodKey = date.toISOString().slice(0, 7);
            break;
          case "week":
            const weekNumber = getWeekNumber(date);
            periodKey = `${date.getFullYear()}-W${weekNumber
              .toString()
              .padStart(2, "0")}`;
            break;
          default:
            periodKey = date.toISOString().slice(0, 10);
        }
        return periodKey === dataPoint.date;
      });
      const wageSum = periodEntries.reduce((sum, entry) => {
        if (!entry.time) return sum;
        const [hours, minutes] = entry.time.split(":").map(Number);
        const totalHours = hours + minutes / 60;
        return sum + (totalHours > 0 ? entry.price / totalHours : 0);
      }, 0);

      const wageCount = periodEntries.filter((entry) => entry.time).length;
      wagePerHour = wageCount > 0 ? wageSum / wageCount : null;

      return {
        ...dataPoint,
        type: dataPoint.date + " - " + dataPoint.type,
        extras: dataPoint.extras.map(({ value }) => value).join(", "),
        wagePerHour:
          wagePerHour !== null ? Number(wagePerHour.toFixed(2)) : null, // <-- 2 decimals
      };
    }
  );

  // Calculate the total count of entries
  const totalCount = filteredEntries.length;

  // Calculate the total price of the filtered entries
  const totalPrice = filteredEntries
    .reduce((total, entry) => total + entry.price, 0)
    .toFixed(2);

  // Calculate the total time of the filtered entries
  const totalTime = filteredEntries.reduce((total, entry) => {
    if (!entry.time) return total; // Skip entries without time
    const [hours, minutes] = entry.time.split(":").map(Number); // Split time into hours and minutes
    return total + hours * 60 + minutes; // Convert to total minutes
  }, 0);

  // Convert total time back to HH:MM format
  const totalTimeFormatted = `${Math.floor(totalTime / 60)
    .toString()
    .padStart(2, "0")}:${(totalTime % 60).toString().padStart(2, "0")}`;

  // Calculate wage per hour for entries with time
  const wagePerHour =
    filteredEntries.reduce((total, entry) => {
      if (!entry.time) return total; // Skip entries without time
      const [hours, minutes] = entry.time.split(":").map(Number);
      const totalHours = hours + minutes / 60; // Convert time to hours
      return total + entry.price / totalHours; // Add wage per hour
    }, 0) / filteredEntries.filter((entry) => entry.time).length; // Average wage per hour

  const wagePerHourFormatted = wagePerHour
    ? `€${wagePerHour.toFixed(2)}`
    : "N/A";

  // Generate a list of years from the entries to populate the year filter dropdown
  const years = [
    ...new Set(entries.map((entry) => new Date(entry.date).getFullYear())),
  ].sort();

  // Calculate average for the selected metric
  let averageValue = null;

  if (chartMetric === "wagePerHour") {
    // Use all entries with time for wage per hour average (matches KPI)
    const wagePerHourEntries = filteredEntries.filter((entry) => entry.time);
    const wagePerHourValues = wagePerHourEntries
      .map((entry) => {
        const [hours, minutes] = entry.time.split(":").map(Number);
        const totalHours = hours + minutes / 60;
        return totalHours > 0 ? entry.price / totalHours : null;
      })
      .filter((v) => v !== null && !isNaN(v));
    averageValue =
      wagePerHourValues.length > 0
        ? wagePerHourValues.reduce((a, b) => a + b, 0) /
          wagePerHourValues.length
        : null;
  } else {
    // For price, use the average of the chart data
    const values = chartData
      .map((d) => d[chartMetric])
      .filter((v) => typeof v === "number" && !isNaN(v));
    averageValue =
      values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null;
  }

  return (
    <div className="container">
      <h1>Commissions Tracker</h1>
      <div className="input-container">
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="input-field"
        >
          <option value="">Select Type</option>
          <option value="Bust Up">Bust Up</option>
          <option value="Hip Up">Hip Up</option>
          <option value="Knee Up">Knee Up</option>
          <option value="Full Body">Full Body</option>
          <option value="Landscape">Landscape</option>
          <option value="Stream Overlay">Stream Overlay</option>
        </select>

        <ReactSelect
          options={options}
          isMulti
          closeMenuOnSelect={false}
          hideSelectedOptions={false}
          components={{
            Option,
          }}
          onChange={handleChange}
          value={selectedExtra}
        />

        <input
          type="number"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button onClick={addEntry}>Add</button>
      </div>

      {/* Year filter dropdown */}
      <div id="kpiBox">
        <div className="year-filter">
          <label htmlFor="year">Filter by Year: </label>
          <select
            id="year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            <option value="">All Years</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {/* Month filter dropdown */}
        <div className="month-filter">
          <label htmlFor="month">Filter by Month: </label>
          <select
            id="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            <option value="">All Months</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i}>
                {new Date(2022, i, 1).toLocaleDateString("en-US", {
                  month: "long",
                })}
              </option>
            ))}
          </select>
        </div>

        {/* Total count and total price */}
        <h3>Total Entries: {totalCount}</h3>
        <h3>Total Price: €{totalPrice}</h3>
        <h3>Total Time: {totalTimeFormatted}</h3>
        <h3>Wage Per Hour: {wagePerHourFormatted}</h3>
      </div>
      <div className="content">
        <div
          className="table-container"
          style={{ overflowY: "auto", height: "400px" }}
        >
          <table>
            <thead>
              <tr
                style={{
                  position: "sticky",
                  top: "0",
                  backgroundColor: "white",
                }}
              >
                <th>Name</th>
                <th>Type</th>
                <th>Extra's</th>
                <th>Price</th>
                <th>Date</th>
                <th>Time</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.name}</td>
                  <td>{entry.type}</td>
                  <td>{entry.extras.map(({ value }) => value).join(", ")}</td>
                  <td>€ {entry.price.toFixed(2)}</td>
                  <td>
                    {new Date(entry.date).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      timeZone: "UTC", // To ensure consistent formatting across different time zones
                      formatMatcher: "basic", // To use the shortest possible representation
                    })}
                  </td>
                  <td>
                    {entry.time ? (
                      <span
                        onDoubleClick={() => {
                          const newTime = prompt(
                            "Edit time (HH:MM):",
                            entry.time
                          );
                          if (newTime) {
                            updateTimeForEntry(entry.id, newTime);
                          }
                        }}
                      >
                        {entry.time}
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          const time = prompt("Enter time (HH:MM):");
                          if (time) {
                            addTimeToEntry(entry.id, time);
                          }
                        }}
                      >
                        Add Time
                      </button>
                    )}
                  </td>
                  <td>
                    <button
                      className="delete-btn"
                      onClick={() => deleteEntry(entry.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bar Chart */}
        <div className="chart-container">
          <div id="togglesDiv">
            <div className="time-period-toggle">
              <button
                onClick={() => setTimePeriod("year")}
                className={timePeriod === "year" ? "active" : ""}
              >
                Year
              </button>
              <button
                onClick={() => setTimePeriod("month")}
                className={timePeriod === "month" ? "active" : ""}
              >
                Month
              </button>
              <button
                onClick={() => setTimePeriod("week")}
                className={timePeriod === "week" ? "active" : ""}
              >
                Week
              </button>
            </div>
            <div className="time-period-toggle">
              <button
                onClick={() => setChartMetric("price")}
                className={chartMetric === "price" ? "active" : ""}
              >
                Show Price
              </button>
              <button
                onClick={() => setChartMetric("wagePerHour")}
                className={chartMetric === "wagePerHour" ? "active" : ""}
              >
                Show Wage Per Hour
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 2" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => {
                  switch (timePeriod) {
                    case "year":
                      return value;
                    case "month":
                      return new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      });
                    case "week":
                      const [year, week] = value.split("-W");
                      return `Week ${week}, ${year}`;
                    default:
                      return value;
                  }
                }}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(value) => {
                  switch (timePeriod) {
                    case "year":
                      return `Year: ${value}`;
                    case "month":
                      return new Date(value).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      });
                    case "week":
                      const [year, week] = value.split("-W");
                      return `Week ${week}, ${year}`;
                    default:
                      return value;
                  }
                }}
              />
              <Bar
                dataKey={chartMetric}
                fill="#4CAF50"
                name={chartMetric === "price" ? "Price" : "Wage Per Hour"}
              />
              {/* Average Line */}
              {averageValue !== null && (
                <ReferenceLine
                  y={averageValue}
                  stroke="#223924"
                  strokeDasharray="4 4"
                  label={{
                    value: `Avg: ${
                      chartMetric === "price" ? "€" : ""
                    }${averageValue.toFixed(2)}`,
                    position: "top",
                    fill: "#002316",
                    fontSize: 12,
                    fontWeight: "bold",
                  }}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default App;
