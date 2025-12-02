"use client";

import { debounce } from "lodash-es";
import { SyntheticEvent, useMemo, useState } from "react";

type shopingList = {
  id: number;
  title: string;
};

// mocking
const getList = (term: string) => {
  return new Promise(async (res: (value: shopingList[]) => void) => {
    if (!term.trim()) {
      return res([]);
    }
    const data = await fetch("query/dummy.json");
    const items = await data.json();
    const query = items.filter((item: { id: number; title: string }) =>
      item.title.includes(term)
    );
    res(query);
  });
};

const Debounce = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [result, setResult] = useState<shopingList[]>([]);

  const debouncedSearch = useMemo(
    () =>
      debounce(async (query: string) => {
        if (query.trim() === "") {
          setResult([]);
          return;
        }
        try {
          const data = await getList(query);
          setResult(data);
        } catch (error) {
          console.error({ error });
          setResult([]);
        }
      }, 500),
    []
  );

  const handleChange = (e: SyntheticEvent<HTMLInputElement>) => {
    const { value } = e.currentTarget;
    setSearchTerm(value);
    debouncedSearch(value);
  };

  return (
    <div className="flex flex-col justify-center items-center">
      <div style={{ padding: "20px" }} className="mt-10 w-3xs">
        <input
          type="text"
          value={searchTerm}
          onChange={handleChange}
          placeholder="search here..."
          className="w-full"
        />
        <div className="border-2 w-full">
          {result.map(({ id, title }: { id: number; title: string }) => (
            <div key={id}>{title}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Debounce;
