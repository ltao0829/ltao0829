import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const USERNAME = "ltao0829";

async function fetchGraphQL(token) {
  const query = `
    query($login: String!) {
      user(login: $login) {
        createdAt
        contributionsCollection {
          contributionYears
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                date
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "profile-stats-generator",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables: { login: USERNAME } })
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  }
  return json.data.user;
}

function calculateStreaks(days) {
  // Sort ascending by date
  days.sort((a, b) => a.date.localeCompare(b.date));

  let totalContributions = 0;
  for (const d of days) {
    totalContributions += d.contributionCount;
  }

  let longestStreak = 0;
  let longestStart = "";
  let longestEnd = "";

  let currentStreak = 0;
  let currentStart = "";
  let currentEnd = "";

  let tempStreak = 0;
  let tempStart = "";

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    if (day.contributionCount > 0) {
      if (tempStreak === 0) {
        tempStart = day.date;
      }
      tempStreak++;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
        longestStart = tempStart;
        longestEnd = day.date;
      }
    } else {
      tempStreak = 0;
      tempStart = "";
    }
  }

  // Calculate current streak starting from today or yesterday
  const todayStr = days[days.length - 1]?.date;
  const yesterdayStr = days[days.length - 2]?.date;

  const todayContrib = days[days.length - 1]?.contributionCount || 0;
  const yesterdayContrib = days[days.length - 2]?.contributionCount || 0;

  if (todayContrib > 0 || yesterdayContrib > 0) {
    let streakCount = 0;
    let endIdx = todayContrib > 0 ? days.length - 1 : days.length - 2;
    currentEnd = days[endIdx].date;

    for (let i = endIdx; i >= 0; i--) {
      if (days[i].contributionCount > 0) {
        streakCount++;
        currentStart = days[i].date;
      } else {
        break;
      }
    }
    currentStreak = streakCount;
  }

  return {
    totalContributions,
    currentStreak,
    currentStart,
    currentEnd,
    longestStreak,
    longestStart,
    longestEnd,
    firstDate: days[0]?.date || "",
    lastDate: todayStr || ""
  };
}

function formatDateRange(start, end) {
  if (!start && !end) return "";
  const opts = { month: "short", day: "numeric" };
  const d1 = start ? new Date(start).toLocaleDateString("en-US", opts) : "";
  const d2 = end ? new Date(end).toLocaleDateString("en-US", opts) : "";
  if (!d1) return d2;
  if (!d2 || d1 === d2) return d1;
  return `${d1} - ${d2}`;
}

function generateStreakSvg(stats) {
  const primaryColor = "#3B82F6";
  const subTextColor = "#94A3B8";

  const totalRange = stats.firstDate
    ? `${new Date(stats.firstDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - Present`
    : "";
  const currentRange = formatDateRange(stats.currentStart, stats.currentEnd) || "No current streak";
  const longestRange = formatDateRange(stats.longestStart, stats.longestEnd) || "None";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 495 195" width="495" height="195" fill="none" role="img" aria-label="GitHub Streak Stats">
  <style>
    .stat-number { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 28px; font-weight: 700; fill: ${primaryColor}; text-anchor: middle; }
    .side-number { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 28px; font-weight: 700; fill: ${subTextColor}; text-anchor: middle; }
    .stat-label { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 600; fill: ${primaryColor}; text-anchor: middle; }
    .side-label { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 600; fill: ${subTextColor}; text-anchor: middle; }
    .stat-date { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; fill: ${subTextColor}; text-anchor: middle; }
    .ring { stroke: ${primaryColor}; stroke-width: 4; stroke-linecap: round; }
    .divider { stroke: #334155; stroke-dasharray: 2; stroke-width: 1; }
  </style>

  <!-- Left: Total Contributions -->
  <g transform="translate(82.5, 0)">
    <text x="0" y="70" class="side-number">${stats.totalContributions}</text>
    <text x="0" y="105" class="side-label">Total Contributions</text>
    <text x="0" y="130" class="stat-date">${totalRange}</text>
  </g>

  <!-- Divider 1 -->
  <line x1="165" y1="40" x2="165" y2="155" class="divider" />

  <!-- Center: Current Streak -->
  <g transform="translate(247.5, 0)">
    <!-- Fire Ring -->
    <circle cx="0" cy="58" r="42" stroke="#1E293B" stroke-width="4" fill="none" />
    <circle cx="0" cy="58" r="42" class="ring" stroke-dasharray="264" stroke-dashoffset="${stats.currentStreak > 0 ? 60 : 264}" transform="rotate(-90 0 58)" />
    <!-- Fire Icon -->
    <path d="M-6,44 C-10,50 -10,56 -4,60 C-2,61 -1,62 -1,64 C-1,66 -3,68 -5,67 C-2,72 5,72 7,67 C9,62 8,58 3,55 C1,54 0,53 1,51 C3,48 4,46 1,42 C-2,44 -4,43 -6,44 Z" fill="${primaryColor}" transform="scale(0.8) translate(-1, -6)" />
    
    <text x="0" y="68" class="stat-number">${stats.currentStreak}</text>
    <text x="0" y="125" class="stat-label">Current Streak</text>
    <text x="0" y="148" class="stat-date">${currentRange}</text>
  </g>

  <!-- Divider 2 -->
  <line x1="330" y1="40" x2="330" y2="155" class="divider" />

  <!-- Right: Longest Streak -->
  <g transform="translate(412.5, 0)">
    <text x="0" y="70" class="side-number">${stats.longestStreak}</text>
    <text x="0" y="105" class="side-label">Longest Streak</text>
    <text x="0" y="130" class="stat-date">${longestRange}</text>
  </g>
</svg>`;
}

function generateActivityGraphSvg(days31) {
  const width = 800;
  const height = 300;
  const paddingLeft = 40;
  const paddingRight = 40;
  const paddingTop = 40;
  const paddingBottom = 50;

  const graphWidth = width - paddingLeft - paddingRight;
  const graphHeight = height - paddingTop - paddingBottom;

  const maxVal = Math.max(5, ...days31.map(d => d.contributionCount));
  const count = days31.length;
  const stepX = graphWidth / (count - 1);

  const points = days31.map((d, i) => {
    const x = paddingLeft + i * stepX;
    const y = paddingTop + graphHeight - (d.contributionCount / maxVal) * graphHeight;
    return { x, y, count: d.contributionCount, date: d.date };
  });

  // Build smooth bezier path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    pathD += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  const areaD = `${pathD} L ${points[points.length - 1].x} ${paddingTop + graphHeight} L ${points[0].x} ${paddingTop + graphHeight} Z`;

  // Generate X-axis labels (5 labels across 31 days)
  const labelIndices = [0, Math.floor(count / 4), Math.floor(count / 2), Math.floor((count * 3) / 4), count - 1];
  const xLabelsSvg = labelIndices.map(idx => {
    const p = points[idx];
    const label = new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `<text x="${p.x.toFixed(1)}" y="${paddingTop + graphHeight + 25}" class="axis-label" text-anchor="middle">${label}</text>`;
  }).join("\n  ");

  // Point circles
  const pointsSvg = points.filter(p => p.count > 0).map(p => {
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#94a3b8" stroke="#3b82f6" stroke-width="2">
      <title>${p.date}: ${p.count} contributions</title>
    </circle>`;
  }).join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="none" role="img" aria-label="Contribution Activity Graph">
  <defs>
    <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.0" />
    </linearGradient>
  </defs>

  <style>
    .title { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; fill: #3b82f6; }
    .axis-label { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; fill: #94a3b8; }
    .grid-line { stroke: #334155; stroke-dasharray: 2; stroke-width: 0.8; opacity: 0.5; }
    .curve { stroke: #3b82f6; stroke-width: 2.5; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  </style>

  <!-- Title -->
  <text x="${paddingLeft}" y="25" class="title">Contribution Activity (Past 31 Days)</text>

  <!-- Grid lines -->
  <line x1="${paddingLeft}" y1="${paddingTop}" x2="${width - paddingRight}" y2="${paddingTop}" class="grid-line" />
  <line x1="${paddingLeft}" y1="${paddingTop + graphHeight / 2}" x2="${width - paddingRight}" y2="${paddingTop + graphHeight / 2}" class="grid-line" />
  <line x1="${paddingLeft}" y1="${paddingTop + graphHeight}" x2="${width - paddingRight}" y2="${paddingTop + graphHeight}" class="grid-line" />

  <!-- Area Fill -->
  <path d="${areaD}" fill="url(#area-grad)" />

  <!-- Line -->
  <path d="${pathD}" class="curve" />

  <!-- Points -->
  ${pointsSvg}

  <!-- X Labels -->
  ${xLabelsSvg}
</svg>`;
}

async function main() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    throw new Error("Missing GITHUB_TOKEN or GH_TOKEN environment variable");
  }

  console.log("Fetching contribution data for", USERNAME);
  const userData = await fetchGraphQL(token);
  const weeks = userData.contributionsCollection.contributionCalendar.weeks;
  const allDays = weeks.flatMap(w => w.contributionDays);

  const stats = calculateStreaks(allDays);
  console.log("Calculated stats:", {
    total: stats.totalContributions,
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak
  });

  const days31 = allDays.slice(-31);

  const streakSvg = generateStreakSvg(stats);
  const activityGraphSvg = generateActivityGraphSvg(days31);

  const outputDir = path.resolve("profile");
  await mkdir(outputDir, { recursive: true });

  const streakPath = path.join(outputDir, "streak.svg");
  const activityGraphPath = path.join(outputDir, "activity-graph.svg");

  await writeFile(streakPath, streakSvg, "utf8");
  await writeFile(activityGraphPath, activityGraphSvg, "utf8");

  console.log("Successfully wrote:");
  console.log("-", streakPath);
  console.log("-", activityGraphPath);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
