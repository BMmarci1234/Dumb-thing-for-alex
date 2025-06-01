# Steps to Get This Code Running

1. **Download [Git](https://git-scm.com/) if you don't have it.**

2. **Clone the repository and install dependencies:**
    ```bash
    git clone https://github.com/BMmarci1234/Dumb-thing-for-alex
    cd Dumb-thing-for-alex
    npm install
    ```

3. **Update your `.env` file with your own IDs and tokens:**
    ```
    DISCORD_CLIENT_ID=Get the client Id
    DISCORD_CLIENT_SECRET=Get the client secret key
    DISCORD_BOT_TOKEN=Get the token
    DISCORD_GUILD_ID=Get the guildId (server id)
    DASHBOARD_ACCESS_ROLE=This is the game staff role Id.
    LOG_CHANNEL_ID=This is the channelId where the bot notifies the staff member that someone has got 16 points.
    PUNISHMENT_DM_USER=The owner's userId
    SESSION_SECRET=Anything you want here
    PORT=3000 (keep this 3000)
    REMOVE_INFRACTION_ROLE=The rank that can remove in game infractions (Senior Mod)
    BAN_PERMISSION_ROLE=The rank that can ban people ingame and on discord.
    OWNER_ID=The owner's userId
    COMMUNITY_MANAGER_ID=The community managers id.
    DISCORD_STAFF=Discord staff Id
    ```

4. **Initialize columns (if required) and deploy Discord commands:**
    ```bash
    node node-add-evidence-column.js
    node node-robloxId-column.js
    node node-username-column.js
    node bot/clear-commands.js
    node bot/deploy-commands.js
    ```

5. **Roblox Script Setup**

    - For the Roblox admin system, use the latest version of `AdminCmds.lua` from  
      [https://sourceb.in/lYf2g40cnv](https://sourceb.in/lYf2g40cnv).
    - **Important:**  
      Replace  
      ```lua
      local url = "https://YOUR_WEB_API_URL/api/moderators"
      ```
      with  
      ```lua
      local url = "https://YOUR_WEBSITE_DASHBOARD_LINK/api/moderators"
      ```
      where `YOUR_WEBSITE_DASHBOARD_LINK` is the URL where your dashboard/API is publicly accessible (e.g. `https://yourdomain.com/api/moderators`).

    - **Put all your game scripts (including `AdminCmds.lua`) inside a `scripts/` folder in your project.**  
      Your project structure should look like:
      ```
      your-repo/
        bot/
        scripts/
          AdminCmds.lua
        ...
      ```

6. **Run the server and bot:**

    - `server.js` is the main file of the project.
    - To run the server and bot, use:
        ```bash
        node server.js
        ```
    - For 24/7 operation and access by at least 100 users, you **must deploy this on a VPS or cloud hosting provider** (not your local PC).
        - Examples:
            - [OVH](https://www.ovh.com/)
            - [DigitalOcean](https://digitalocean.com/)
            - [Linode](https://linode.com/)
            - [Vultr](https://www.vultr.com/)
            - [AWS Lightsail](https://aws.amazon.com/lightsail/)
            - [Time4VPS](https://www.time4vps.com/)
            - [VIRMACH](https://virmach.com/)
            - [Netcup](https://www.netcup.eu/)
            - [GitHub Education](https://education.github.com/pack) (students)
            - [Microsoft Students](https://azure.microsoft.com/en-us/free/students/)
            - [Google Cloud Free Tier](https://cloud.google.com/free)

    - To keep your server running 24/7, it's recommended to use a process manager like [PM2](https://pm2.keymetrics.io/):
        ```bash
        npm install -g pm2
        pm2 start server.js
        pm2 save
        pm2 startup
        ```

---

**Note:**  
- Make sure your firewall allows inbound connections to your chosen port (default: 3000) and that your bot's token and IDs are never shared publicly.
- The website and Discord bot will now be accessible to at least 100 different people from different networks via your VPS/cloud server.
- All Roblox-related scripts should be placed inside the `scripts` folder in your project.

Happy hosting!
