import { client } from "@/utils/client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// async function fetchUsers() {
//   const res = await client.users.$get({ query: { limit: 5 } });
//   console.log("res", res);
//   if (res.ok) {
//     const data = await res.json();
//     console.log("Users:", data);
//   }
// }
//   useEffect(() => {
//     fetchUsers();
//   }, []);

function App() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center">
      <Button>Click me</Button>
    </div>
  );
}

export default App;
