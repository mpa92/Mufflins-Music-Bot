const fs = require('fs');
const path = require('path');

/**
 * Get the path to a Mufflins icon for a command
 * @param {string} commandName - The command name to search for
 * @returns {string|null} - Path to the icon file or null if not found
 */
function getMufflinsIcon(commandName) {
    const iconsDir = path.join(process.cwd(), 'mufflins icons');
    
    // Check if icons directory exists
    if (!fs.existsSync(iconsDir)) {
        console.log(`Icons directory not found: ${iconsDir}`);
        return null;
    }
    
    try {
        // Find icon file that matches the command name
        const iconFile = fs.readdirSync(iconsDir).find(file => 
            file.toLowerCase().includes(commandName.toLowerCase()) && 
            (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.gif'))
        );
        
        if (iconFile) {
            return path.join(iconsDir, iconFile);
        }
    } catch (error) {
        console.error(`Error reading icons directory: ${error.message}`);
    }
    
    return null;
}

module.exports = { getMufflinsIcon };

