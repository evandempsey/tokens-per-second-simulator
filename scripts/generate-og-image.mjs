import { createCanvas } from "canvas";
import { writeFileSync } from "fs";

const WIDTH = 1200;
const HEIGHT = 630;

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext("2d");

// Background
ctx.fillStyle = "#0F0F0F";
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Subtle grid lines for texture
ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
ctx.lineWidth = 1;
for (let y = 0; y < HEIGHT; y += 40) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(WIDTH, y);
  ctx.stroke();
}

// Title
ctx.fillStyle = "#F5F5F5";
ctx.font = "bold 64px sans-serif";
ctx.fillText("Tokens per Second", 80, 160);

// Subtitle
ctx.fillStyle = "#A3A3A3";
ctx.font = "28px sans-serif";
ctx.fillText("See what local LLM inference speeds feel like", 80, 215);

// Divider line
ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(80, 250);
ctx.lineTo(1120, 250);
ctx.stroke();

// Speed comparison bars
const bars = [
  { speed: 8, label: "8 tok/s", fill: 0.18 },
  { speed: 50, label: "50 tok/s", fill: 0.55 },
  { speed: 200, label: "200 tok/s", fill: 0.92 },
];

const barStartX = 230;
const barWidth = 700;
const barHeight = 32;
const barGap = 56;
let barY = 300;

for (const bar of bars) {
  // Label
  ctx.fillStyle = "#A3A3A3";
  ctx.font = "bold 20px monospace";
  ctx.textAlign = "right";
  ctx.fillText(bar.label, barStartX - 20, barY + 22);
  ctx.textAlign = "left";

  // Track (empty)
  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  ctx.beginPath();
  ctx.roundRect(barStartX, barY, barWidth, barHeight, 4);
  ctx.fill();

  // Filled portion
  const filledWidth = barWidth * bar.fill;
  ctx.fillStyle = "#F5F5F5";
  ctx.beginPath();
  ctx.roundRect(barStartX, barY, filledWidth, barHeight, 4);
  ctx.fill();

  barY += barHeight + barGap;
}

// Speed pills at bottom
const speeds = ["8", "25", "50", "100", "200"];
ctx.font = "bold 18px sans-serif";
let pillX = 80;
const pillY = 530;

for (const speed of speeds) {
  const label = `${speed} tok/s`;
  const textWidth = ctx.measureText(label).width;
  const pillWidth = textWidth + 24;
  const pillHeight = 36;

  // Pill background
  ctx.fillStyle = speed === "50" ? "#F5F5F5" : "rgba(255, 255, 255, 0.08)";
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 6);
  ctx.fill();

  // Pill text
  ctx.fillStyle = speed === "50" ? "#0F0F0F" : "#A3A3A3";
  ctx.fillText(label, pillX + 12, pillY + 24);

  pillX += pillWidth + 12;
}

// Write PNG
const buffer = canvas.toBuffer("image/png");
writeFileSync("public/og-image.png", buffer);
console.log("Generated public/og-image.png (1200x630)");
