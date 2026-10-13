// Rotating "service announcements" on the home page. Keep them kind.
export const ANNOUNCEMENTS = [
  "Service change: Butler is running on three hours of sleep until finals.",
  "JJ's wait time is currently: yes.",
  "Delays on the 1 train because someone is reading Lit Hum out loud.",
  "Lerner elevators are thinking about it. Please stand by.",
  "Low Steps seating is first come, first sunburnt.",
  "Housing lottery update: your number has not gotten better since you last checked.",
  "Ferris is serving the same thing as yesterday, but with confidence.",
  "Reminder: the Core is not a personality. It is three personalities.",
  "Wi-Fi in John Jay is doing its best. Please lower your expectations accordingly.",
  "Weather on College Walk: windy enough to rethink your outfit.",
  "Recruiting season advisory: everyone is fine and nobody is checking LinkedIn.",
  "Midterm forecast: 100% chance of saying you will start studying tomorrow.",
];

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "Up this late? Same. Here is something funnier than your problem set.";
  if (h < 12) return "Morning. Coffee first, then captions.";
  if (h < 17) return "Afternoon slump? Vote on a few captions and call it a study break.";
  if (h < 21) return "Evening. The perfect time to avoid your readings.";
  return "Night owl hours. Butler can wait five more minutes.";
}

// Landing page jokes: the setup is free, the punchline needs a login
export const JOKES = [
  { setup: "I asked the housing lottery for a single.", punch: "It gave me a single window." },
  { setup: "I started the Lit Hum reading at 9 pm.", punch: "By 9:05 I was reading the SparkNotes of the SparkNotes." },
  { setup: "My GPA and the 1 train have something in common.", punch: "Both say “delays expected” and mean it." },
  { setup: "I told my parents I spend all day in Butler.", punch: "Technically true. The Blue Java line is in Butler." },
  { setup: "My advisor said to find something I'm passionate about.", punch: "I found the Ferris dessert bar. She meant a major." },
  { setup: "A recruiter asked where I see myself in five years.", punch: "Honestly? Still in the JJ's line." },
];
