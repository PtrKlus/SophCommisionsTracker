import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";

function App() {
  const [entries, setEntries] = useState([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState("");
  const [selectedYear, setSelectedYear] = useState(""); // Added year filter state

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
      };
      const docRef = await addDoc(collection(db, "entries"), newEntry);
      setEntries([...entries, { id: docRef.id, ...newEntry }]);
      setName("");
      setPrice("");
      setDate("");
    }
  };

  const deleteEntry = async (id) => {
    await deleteDoc(doc(db, "entries", id));
    const updatedEntries = entries.filter((entry) => entry.id !== id);
    setEntries(updatedEntries);
  };

  // Filter entries by selected year
  const filterEntriesByYear = (entries, year) => {
    if (!year) return entries; // If no year is selected, return all entries
    return entries.filter(
      (entry) => new Date(entry.date).getFullYear() === parseInt(year)
    );
  };

  // Group entries by month (Year-Month format) and aggregate prices
  const aggregateDataByMonth = (entries) => {
    const aggregatedData = {};

    entries.forEach((entry) => {
      // Extract the year and month from the date (format: YYYY-MM)
      const monthKey = new Date(entry.date).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "2-digit",
      });

      // If the monthKey already exists, add the price to the existing value
      if (aggregatedData[monthKey]) {
        aggregatedData[monthKey].price += entry.price;
      } else {
        aggregatedData[monthKey] = { date: monthKey, price: entry.price };
      }
    });

    // Convert the aggregated object to an array
    return Object.values(aggregatedData);
  };

  // Prepare aggregated data for the BarChart (grouped by month)
  const filteredEntries = filterEntriesByYear(entries, selectedYear);
  const chartData = aggregateDataByMonth(filteredEntries);

  // Calculate the total count of entries
  const totalCount = filteredEntries.length;

  // Calculate the total price of the filtered entries
  const totalPrice = filteredEntries
    .reduce((total, entry) => total + entry.price, 0)
    .toFixed(2);

  // Generate a list of years from the entries to populate the year filter dropdown
  const years = [
    ...new Set(entries.map((entry) => new Date(entry.date).getFullYear())),
  ].sort();

  return (
    <div className="container">
      <h1>Name and Price Tracker</h1>
      <div className="input-container">
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
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

      <h2>Entries</h2>
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

        {/* Total count and total price */}
        <h3>Total Entries: {totalCount}</h3>
        <h3>Total Price: ${totalPrice}</h3>
      </div>
      <div className="content">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.name}</td>
                  <td>{entry.price.toFixed(2)}</td>
                  <td>{entry.date}</td>
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
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="price" fill="#4CAF50" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default App;
