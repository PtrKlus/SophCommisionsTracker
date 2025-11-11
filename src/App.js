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

// Custom MultiValue to hide chips
const MonthMultiValue = () => null;

function App() {
  const [entries, setEntries] = useState([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [timePeriod, setTimePeriod] = useState("month");
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [selectedType, setSelectedType] = useState("");
  const [selectedExtra, setSelectedExtra] = useState([]);
  const [chartMetric, setChartMetric] = useState("price");
  const [xAxisKey, setXAxisKey] = useState("date");

  const options = [
    { value: "Extra Animal", label: "Extra Animal" },
    { value: "Complex Background", label: "Complex Background" },
    { value: "Detailed Prop", label: "Detailed Prop" },
    { value: "Commercial", label: "Commercial" },
    { value: "Rush", label: "Rush" },
    { value: "1 Added Character", label: "1 Added Character" },
    { value: "2 Added Characters", label: "2 Added Characters" },
    { value: "3 Added Characters", label: "3 Added Characters" },
    { value: "Bundle Discount", label: "Bundle Discount" },
    { value: "Surprise Me", label: "Surprise Me" },
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
  const filterEntriesByYear = (entries, year, months) => {
    return entries.filter((entry) => {
      const entryYear = new Date(entry.date).getFullYear();
      const entryMonth = new Date(entry.date).getMonth();
      const yearMatch = year ? entryYear === parseInt(year) : true;
      const monthMatch =
        !months || months.length === 0
          ? true
          : months.some((m) => entryMonth === parseInt(m.value));
      return yearMatch && monthMatch;
    });
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
    selectedMonths
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
      // NEW: compute total price and total hours for the period, then divide
      const { totalPriceWithTime, totalHours } = periodEntries.reduce(
        (acc, entry) => {
          if (!entry.time) return acc;
          const [hours, minutes] = entry.time.split(":").map(Number);
          const hrs = hours + minutes / 60;
          return {
            totalPriceWithTime: acc.totalPriceWithTime + entry.price,
            totalHours: acc.totalHours + (hrs > 0 ? hrs : 0),
          };
        },
        { totalPriceWithTime: 0, totalHours: 0 }
      );

      wagePerHour = totalHours > 0 ? totalPriceWithTime / totalHours : null;

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
  const wagePerHour = (() => {
    const { totalPriceWithTime, totalHours } = filteredEntries.reduce(
      (acc, entry) => {
        if (!entry.time) return acc;
        const [hours, minutes] = entry.time.split(":").map(Number);
        const hrs = hours + minutes / 60;
        if (hrs <= 0) return acc;
        return {
          totalPriceWithTime: acc.totalPriceWithTime + entry.price,
          totalHours: acc.totalHours + hrs,
        };
      },
      { totalPriceWithTime: 0, totalHours: 0 }
    );
    return totalHours > 0 ? totalPriceWithTime / totalHours : null;
  })();

  const wagePerHourFormatted = wagePerHour
    ? `€${wagePerHour.toFixed(2)}`
    : "N/A";

  // Generate a list of years from the entries to populate the year filter dropdown
  const years = [
    ...new Set(entries.map((entry) => new Date(entry.date).getFullYear())),
  ].sort();

  // Group by type if xAxisKey is "type"
  const chartDataByType = React.useMemo(() => {
    if (xAxisKey !== "type") return chartData;
    // Aggregate by type using total price / total hours per type
    const typeMap = {};
    filteredEntries.forEach((entry) => {
      const typeKey = entry.type || "Unknown";
      if (!typeMap[typeKey]) {
        typeMap[typeKey] = {
          type: typeKey,
          price: 0,
          totalPriceWithTime: 0,
          totalHours: 0,
        };
      }
      typeMap[typeKey].price += entry.price;
      if (entry.time) {
        const [hours, minutes] = entry.time.split(":").map(Number);
        const hrs = hours + minutes / 60;
        if (hrs > 0) {
          typeMap[typeKey].totalPriceWithTime += entry.price;
          typeMap[typeKey].totalHours += hrs;
        }
      }
    });
    return Object.values(typeMap).map((d) => ({
      ...d,
      wagePerHour:
        d.totalHours > 0
          ? Number((d.totalPriceWithTime / d.totalHours).toFixed(2))
          : null,
    }));
  }, [xAxisKey, filteredEntries, chartData]);

  // Calculate average for the selected metric
  let averageValue = null;

  if (chartMetric === "wagePerHour") {
    // Use the overall weighted KPI (total price with time / total hours)
    averageValue = wagePerHour;
  } else {
    // Use the currently-displayed dataset (by date or by type) to compute average
    const sourceData = xAxisKey === "type" ? chartDataByType : chartData;
    const values = sourceData
      .map((d) => d[chartMetric])
      .filter((v) => typeof v === "number" && !isNaN(v));
    averageValue =
      values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null;
  }

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i.toString(),
    label: new Date(2022, i, 1).toLocaleDateString("en-US", { month: "long" }),
  }));

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
          <option value="Character Bust">Character Bust</option>
          <option value="Character Half Body">Character Half Body</option>
          <option value="Character Full Body">Character Full Body</option>
          <option value="Animal Half Body">Animal Half Body</option>
          <option value="Animal Full Body">Animal Full Body</option>
          <option value="Background / Landscape">Background / Landscape</option>
          <option value="Chibi">Chibi</option>
          <option value="Club Outfit">Club Outfit</option>
          <option value="Decor / Story Stickers">Decor / Story Stickers</option>
          <option value="Highlight Covers / Story BG">
            Highlight Covers / Story BG
          </option>
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
        <div
          className="month-filter"
          style={{ minWidth: 180, position: "relative" }}
        >
          <label htmlFor="month">Filter by Month: </label>
          <ReactSelect
            id="month"
            options={monthOptions}
            isMulti
            closeMenuOnSelect={false}
            hideSelectedOptions={false}
            components={{
              Option,
              MultiValue: MonthMultiValue,
            }}
            value={selectedMonths}
            onChange={setSelectedMonths}
            placeholder=""
            styles={{
              control: (base) => ({
                ...base,
                minHeight: 32,
                fontSize: 14,
                width: 200,
              }),
              valueContainer: (base) => ({
                ...base,
                padding: "0 6px",
              }),
              indicatorsContainer: (base) => ({
                ...base,
                height: 32,
              }),
              multiValue: (base) => ({
                ...base,
                display: "none", // Hide chips for compactness
              }),
            }}
          />
          {/* Custom overlay label */}
          <div
            style={{
              position: "absolute",
              left: 155,
              top: 9,
              pointerEvents: "none",
              fontSize: 14,
              color: "#555",
              background: "white",
              padding: "0 4px",
              zIndex: 1,
              maxWidth: 90,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {selectedMonths.length === 0
              ? "All Months"
              : selectedMonths.length === 1
              ? selectedMonths[0].label
              : "Multiple"}
          </div>
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
            {/* Time period dropdown */}
            <div className="time-period-dropdown">
              <label htmlFor="period-select">Period: </label>
              <select
                id="period-select"
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value)}
              >
                <option value="year">Year</option>
                <option value="month">Month</option>
                <option value="week">Week</option>
              </select>
            </div>
            {/* Chart metric dropdown */}
            <div className="metric-dropdown">
              <label htmlFor="metric-select">Metric: </label>
              <select
                id="metric-select"
                value={chartMetric}
                onChange={(e) => setChartMetric(e.target.value)}
              >
                <option value="price">Show Price</option>
                <option value="wagePerHour">Show Wage Per Hour</option>
              </select>
            </div>
            {/* X-axis grouping dropdown */}
            <div className="groupby-dropdown">
              <label htmlFor="groupby-select">Group By: </label>
              <select
                id="groupby-select"
                value={xAxisKey}
                onChange={(e) => setXAxisKey(e.target.value)}
              >
                <option value="date">Date</option>
                <option value="type">Type</option>
              </select>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={xAxisKey === "type" ? chartDataByType : chartData}>
              <CartesianGrid strokeDasharray="3 2" vertical={false} />
              <XAxis
                dataKey={xAxisKey}
                tickFormatter={(value) => {
                  if (xAxisKey === "type") return value;
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
                  if (xAxisKey === "type") {
                    return `${value}`;
                  }
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
