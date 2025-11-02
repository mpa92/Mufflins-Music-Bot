module.exports = {
    convertTime: (duration, format = false) => {
        if (isNaN(duration) || typeof duration === 'undefined') return '00:00';
        if (duration > 3600000000) return 'Live';
        
        const seconds = Math.floor((duration / 1000) % 60);
        const minutes = Math.floor((duration / (1000 * 60)) % 60);
        const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
        
        const hoursStr = hours > 0 ? `${hours}:` : '';
        const minutesStr = minutes < 10 && hours > 0 ? `0${minutes}` : `${minutes}`;
        const secondsStr = seconds < 10 ? `0${seconds}` : `${seconds}`;
        
        return `${hoursStr}${minutesStr}:${secondsStr}`;
    }
};

