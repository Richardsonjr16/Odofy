function isMerchantOpen(openingTime, closingTime, timezone) {
  const timeString = new Date().toLocaleTimeString('en-US', {
    timeZone: timezone || 'America/Chicago',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return timeString >= openingTime && timeString <= closingTime;
}

function formatTime(timeStr) {
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

module.exports = { isMerchantOpen, formatTime };
