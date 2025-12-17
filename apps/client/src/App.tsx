import { client } from "@/utils/client";
import { useEffect } from "react";

async function fetchUsers() {
  const res = await client.users.$get({ query: { limit: 5 } });
  console.log("res", res);
  if (res.ok) {
    const data = await res.json();
    console.log("Users:", data);
  }
}

function App() {
  useEffect(() => {
    fetchUsers();
  }, []);
  return <>HELLO</>;
}

export default App;
