// แปลงจำนวนนาทีเป็นชั่วโมง เช่น 135 นาที -> 2 ชม. 15 นาที
export function formatMinutes(minutes) {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) {
    return "-";
  }

  const total = Math.round(minutes);
  if (total < 60) return `${total} นาที`;

  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return mins === 0 ? `${hours} ชม.` : `${hours} ชม. ${mins} นาที`;
}