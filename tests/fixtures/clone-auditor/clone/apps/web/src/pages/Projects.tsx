// Filled-in page.
import { useEffect, useState } from "react";

export default function Projects() {
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then(setProjects);
  }, []);
  return (
    <section>
      <h1>Projects</h1>
      <ul>{projects.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
    </section>
  );
}
