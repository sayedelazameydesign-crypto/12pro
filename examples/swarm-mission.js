/**
 * Example: Swarm mission - multiple agents collaborate
 */
export const swarmMission = {
  goal: "Build a 12-layer repository structure",
  agents: [
    { role: "architect", tasks: ["design structure"] },
    { role: "implementer", tasks: ["create files"] },
    { role: "tester", tasks: ["verify gates"] }
  ],
  consensus: "majority"
};
