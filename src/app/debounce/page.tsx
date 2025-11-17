"use client";

import { debounce } from "lodash-es";
import { SyntheticEvent, useMemo, useState } from "react";

const Debounce = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [result, setResult] = useState([]);

  const debouncedSearch = useMemo(
    () =>
      debounce(async (query: string) => {
        if (query.trim() === "") {
          setResult([]);
          return;
        }
        try {
          const res = await fetch(`/qoute?query=${encodeURIComponent(query)}`);
          if (res.ok) {
            const data = await res.json();
            setResult(data.results || []);
          } else {
            console.log("??", query);

            setResult([]);
          }
        } catch (error) {
          console.log("error");
          setResult([]);
        }
      }, 300),
    []
  );

  const handleChange = (e: SyntheticEvent<HTMLInputElement>) => {
    const { value } = e.currentTarget;
    setSearchTerm(value);
    debouncedSearch(value);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2 style={{ marginBottom: "15px" }}>test</h2>
      <input
        type="text"
        value={searchTerm}
        onChange={handleChange}
        placeholder="search here..."
      />
    </div>
  );
};

export default Debounce;
