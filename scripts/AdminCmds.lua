-- Services
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local DataStoreService = game:GetService("DataStoreService")
local RunService = game:GetService("RunService") 
local Workspace = game:GetService("Workspace")
local HttpService = game:GetService("HttpService")

local AdminCommandEvent = ReplicatedStorage:WaitForChild("AdminCommandEvent")
local SetViewPOVEvent = ReplicatedStorage:WaitForChild("SetViewPOVEvent") 
local banDataStore = DataStoreService:GetDataStore("PlayerBansV2")

-- Configuration
local ADMIN_USER_IDS = {1590751364, 7199856703} -- Full privileges, including unban

-- MODERATOR API SYNC (replace your old MOD_USER_IDS logic with everything in this block)
local MOD_USER_IDS = {0}
local API_KEY = "YOUR_SUPER_SECRET_API_KEY" -- Set this to match your .env in server.js
local function fetchModsFromAPI()
    local url = "https://YOUR_WEB_API_URL/api/moderators?apiKey=" .. API_KEY -- <-- Use your actual API endpoint and key
    local success, result = pcall(function()
        return HttpService:GetAsync(url)
    end)
    if success then
        local mods = HttpService:JSONDecode(result)
        MOD_USER_IDS = {}
        for _, mod in ipairs(mods) do
            table.insert(MOD_USER_IDS, tonumber(mod.robloxId))
        end
        print("[AdminCmds] Refreshed MOD_USER_IDS from API: "..#MOD_USER_IDS)
    else
        warn("[AdminCmds] Could not fetch moderators list: " .. tostring(result))
    end
end
fetchModsFromAPI()
spawn(function()
    while true do
        wait(600)
        fetchModsFromAPI()
    end
end)

local function isPlayerMod(player)
    if not player then return false end
    for _, id in ipairs(MOD_USER_IDS) do
        if player.UserId == id then
            return true
        end
    end
    return false
end
-- END MODERATOR API SYNC

local BAN_COMMAND_PREFIX = ":ban"
local UNBAN_COMMAND_PREFIX = ":unban"
local BRING_COMMAND_PREFIX = ":bring"
local KICK_COMMAND_PREFIX = ":kick"
local VIEW_COMMAND_PREFIX = ":view"
local TO_COMMAND_PREFIX = ":to" 
local DEFAULT_BAN_REASON = "No reason specified."
local DEFAULT_KICK_REASON = "You have been kicked from the game."
local PERMANENT_BAN_TEXT = "Permanent"

local BAN_PLACE_LOCATION = Vector3.new(0, 250, 0) -- Designated location for banned players
local RequestBanAppealEvent = ReplicatedStorage:FindFirstChild("RequestBanAppealEvent")

-- Forward declaration for onPlayerAdded and other processing functions
local onPlayerAdded
local processBanCommand 
local processUnbanCommand 
local processBringCommand 
local processKickCommand 
local processViewCommand 
local processToCommand 
local showBanScreen
local applyBanToCharacter

-- Helper functions for permission checks
local function isPlayerAdmin(player)
    if not player then return false end
    for _, id in ipairs(ADMIN_USER_IDS) do
        if player.UserId == id then
            return true
        end
    end
    return false
end

local function isPlayerMod(player)
    if not player then return false end
    for _, id in ipairs(MOD_USER_IDS) do
        if player.UserId == id then
            return true
        end
    end
    return false
end

local function canPlayerUseGeneralCommands(player)
    return isPlayerAdmin(player) or isPlayerMod(player) -- Admins and Mods can use general commands
end

-- Helper function to find a player by partial name
local function findPlayerByPartialName(partialName, adminPlayer)
    if not partialName or partialName == "" then
        print(adminPlayer.Name .. " provided an empty name to search for.")
        return nil
    end

    local lowerPartialName = partialName:lower()
    local foundPlayers = {}

    for _, player in ipairs(Players:GetPlayers()) do
        if player.Name:lower():sub(1, #lowerPartialName) == lowerPartialName then
            table.insert(foundPlayers, player)
        end
    end

    if #foundPlayers == 0 then
        print(adminPlayer.Name .. " tried to find player starting with '" .. partialName .. "', but no match was found.")
        return nil
    elseif #foundPlayers == 1 then
        return foundPlayers[1]
    else
        local names = {}
        for _, p in ipairs(foundPlayers) do
            table.insert(names, p.Name)
        end
        print(adminPlayer.Name .. " tried to find player starting with '" .. partialName .. "', but multiple matches were found: " .. table.concat(names, ", ") .. ". Please be more specific.")
        return nil
    end
end

showBanScreen = function(player, banReason, banDurationText)
    local playerGui = player:FindFirstChild("PlayerGui")
    if not playerGui then return end
    local banGui = playerGui:FindFirstChild("BanInfoGui")

    if not banGui then
        banGui = Instance.new("ScreenGui")
        banGui.Name = "BanInfoGui"
        banGui.ResetOnSpawn = false -- Persist across respawns
        banGui.DisplayOrder = 1001 -- Ensure it's on top
        banGui.IgnoreGuiInset = true -- Cover the entire screen potentially

        local frame = Instance.new("Frame")
        frame.Name = "Frame"
        frame.Size = UDim2.new(0.6, 0, 0.4, 0)
        frame.AnchorPoint = Vector2.new(0.5, 0.5)
        frame.Position = UDim2.new(0.5, 0, 0.5, 0)
        frame.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
        frame.BorderColor3 = Color3.fromRGB(180, 20, 20)
        frame.BorderSizePixel = 2
        frame.Parent = banGui

        local title = Instance.new("TextLabel")
        title.Name = "TitleLabel"
        title.Size = UDim2.new(1, -20, 0, 40)
        title.Position = UDim2.new(0.5, 0, 0, 15)
        title.AnchorPoint = Vector2.new(0.5, 0)
        title.BackgroundTransparency = 1
        title.Font = Enum.Font.SourceSansBold
        title.Text = "YOU ARE BANNED"
        title.TextColor3 = Color3.fromRGB(255, 60, 60)
        title.TextSize = 30
        title.Parent = frame

        local reasonLabel = Instance.new("TextLabel")
        reasonLabel.Name = "ReasonLabel"
        reasonLabel.Size = UDim2.new(1, -40, 0.3, 0) -- Relative height
        reasonLabel.Position = UDim2.new(0.5, 0, 0.25, 0) -- Positioned below title
        reasonLabel.AnchorPoint = Vector2.new(0.5, 0)
        reasonLabel.BackgroundTransparency = 1
        reasonLabel.Font = Enum.Font.SourceSans
        reasonLabel.TextColor3 = Color3.fromRGB(230, 230, 230)
        reasonLabel.TextWrapped = true
        reasonLabel.TextYAlignment = Enum.TextYAlignment.Top
        reasonLabel.TextSize = 18
        reasonLabel.Parent = frame
        
        local durationLabel = Instance.new("TextLabel")
        durationLabel.Name = "DurationLabel"
        durationLabel.Size = UDim2.new(1, -40, 0, 30)
        durationLabel.Position = UDim2.new(0.5, 0, 0.65, 0) -- Positioned below reason
        durationLabel.AnchorPoint = Vector2.new(0.5, 0)
        durationLabel.BackgroundTransparency = 1
        durationLabel.Font = Enum.Font.SourceSans
        durationLabel.TextColor3 = Color3.fromRGB(230, 230, 230)
        durationLabel.TextSize = 18
        durationLabel.Parent = frame

        local appealButton = Instance.new("TextButton")
        appealButton.Name = "BanAppealButton" -- Specific name for LocalScript
        appealButton.Size = UDim2.new(0.7, 0, 0, 45)
        appealButton.Position = UDim2.new(0.5, 0, 1, -20) -- Anchored to bottom
        appealButton.AnchorPoint = Vector2.new(0.5, 1)
        appealButton.BackgroundColor3 = Color3.fromRGB(70, 70, 70)
        appealButton.BorderColor3 = Color3.fromRGB(100,100,100)
        appealButton.BorderSizePixel = 1
        appealButton.Font = Enum.Font.SourceSansBold
        appealButton.Text = "Request Appeal"
        appealButton.TextColor3 = Color3.fromRGB(255, 255, 255)
        appealButton.TextSize = 20
        appealButton.Parent = frame
        
        banGui.Parent = playerGui
    end

    -- Update text content
    local currentFrame = banGui:FindFirstChild("Frame")
    if currentFrame then
        local reasonTextLabel = currentFrame:FindFirstChild("ReasonLabel")
        if reasonTextLabel then reasonTextLabel.Text = "Reason: " .. (banReason or DEFAULT_BAN_REASON) end
        
        local durationTextLabel = currentFrame:FindFirstChild("DurationLabel")
        if durationTextLabel then durationTextLabel.Text = "Duration: " .. banDurationText end
    end
end

applyBanToCharacter = function(player, character, banData, durationDisplay)
    if not character then 
        warn(string.format("ApplyBanToCharacter: No character for player %s", player.Name))
        return 
    end
    local humanoid = character:FindFirstChildOfClass("Humanoid")
    local rootPart = character:FindFirstChild("HumanoidRootPart")

    if humanoid and rootPart then
        task.defer(function() -- Use task.defer for teleportation
            if rootPart and rootPart.Parent and humanoid and humanoid.Parent then -- Re-check validity
                 rootPart.CFrame = CFrame.new(BAN_PLACE_LOCATION)
                 humanoid.WalkSpeed = 0
                 humanoid.JumpPower = 0
            end
        end)
        print(string.format("Applied ban measures to %s. Teleported to ban place, movement restricted.", player.Name))
        showBanScreen(player, banData.Reason, durationDisplay)
    else
        warn(string.format("Cannot apply ban to character for %s: Humanoid or RootPart missing after defer.", player.Name))
        player:Kick(string.format("You are banned. Error setting up ban environment.\nReason: %s\nDuration: %s", 
            banData.Reason or DEFAULT_BAN_REASON, durationDisplay))
    end
end

-- Function to check and enforce ban on player joining
local function checkPlayerBan(player)
    local userIdStr = tostring(player.UserId)
    local banData
    local success, result = pcall(function()
        banData = banDataStore:GetAsync(userIdStr)
    end)

    if not success then
        warn(string.format("Failed to check ban status for %s (ID: %s): %s", player.Name, userIdStr, tostring(result)))
        return true 
    end

    if banData then
        local isPermanent = (banData.ExpiryTimestamp == 0)
        local isExpired = false
        if not isPermanent then
            isExpired = (os.time() > banData.ExpiryTimestamp)
        end

        if isExpired then
            print(string.format("Ban for %s (ID: %s) has expired. Removing record.", player.Name, userIdStr))
            local remSuccess, remErr = pcall(function()
                banDataStore:RemoveAsync(userIdStr)
            end)
            if not remSuccess then
                warn(string.format("Failed to remove expired ban data for %s (ID: %s): %s", player.Name, userIdStr, tostring(remErr)))
            end
            return true
        end
        
        local durationDisplay
        if isPermanent then
            durationDisplay = PERMANENT_BAN_TEXT
        else
            local remainingSeconds = banData.ExpiryTimestamp - os.time()
            if remainingSeconds <= 0 then 
                print(string.format("Ban for %s (ID: %s) just expired (fallback). Removing record.", player.Name, userIdStr))
                pcall(function() banDataStore:RemoveAsync(userIdStr) end)
                return true 
            end
            local remainingMinutes = math.ceil(remainingSeconds / 60)
            durationDisplay = remainingMinutes .. " minute(s) remaining"
        end
        
        print(string.format("%s (ID: %s) is banned. Reason: %s. Duration: %s. Processing for ban place.", 
                            player.Name, userIdStr, banData.Reason or DEFAULT_BAN_REASON, durationDisplay))

        local function onCharacterLoadAndApply(char)
            applyBanToCharacter(player, char, banData, durationDisplay)
        end

        if player.Character then
            onCharacterLoadAndApply(player.Character)
        else
            local charAddedConn
            charAddedConn = player.CharacterAdded:Connect(function(char)
                onCharacterLoadAndApply(char)
                if charAddedConn then -- Disconnect after first fire for this initial setup
                    charAddedConn:Disconnect()
                    charAddedConn = nil
                end
            end)
        end
        return false -- Player is banned and being handled for ban place
    end
    return true -- Player is not banned
end

-- Function to handle the ban command
processBanCommand = function(adminPlayer, argumentsString)
    if not canPlayerUseGeneralCommands(adminPlayer) then
        print(adminPlayer.Name .. " (ID: " .. adminPlayer.UserId .. ") attempted to use ban command without permission.")
        return
    end

    local parts = {}
    for part in string.gmatch(argumentsString, "[^%s]+") do
        table.insert(parts, part)
    end

    if #parts < 1 then
        print(adminPlayer.Name .. " used an incomplete ban command. Usage: <PlayerName> [DurationInMinutes/perm] [Reason...]")
        return
    end

    local targetPlayerName = parts[1]
    local targetPlayer = findPlayerByPartialName(targetPlayerName, adminPlayer)

    if not targetPlayer then
        return
    end

    if targetPlayer == adminPlayer then
        print(adminPlayer.Name .. " cannot ban themselves.")
        return
    end

    local banDurationMinutes
    local isPermanentBan = false
    local reason = DEFAULT_BAN_REASON
    local reasonStartIndex = 2
    local banExpiryTimestamp
    local durationTextForKick = PERMANENT_BAN_TEXT -- This will now be for UI

    if #parts >= 2 then
        local secondArg = parts[2]
        local durationNumCheck = tonumber(secondArg)

        if durationNumCheck and durationNumCheck > 0 then
            banDurationMinutes = durationNumCheck
            reasonStartIndex = 3
            banExpiryTimestamp = os.time() + (banDurationMinutes * 60)
            durationTextForKick = banDurationMinutes .. " minute(s)"
        elseif secondArg:lower() == "perm" then
            isPermanentBan = true
            reasonStartIndex = 3
            banExpiryTimestamp = 0 
            durationTextForKick = PERMANENT_BAN_TEXT
        else
            isPermanentBan = true
            reasonStartIndex = 2 
            banExpiryTimestamp = 0
            durationTextForKick = PERMANENT_BAN_TEXT
        end
        
        if #parts >= reasonStartIndex then
            local reasonWords = {}
            for i = reasonStartIndex, #parts do
                table.insert(reasonWords, parts[i])
            end
            if #reasonWords > 0 then
                reason = table.concat(reasonWords, " ")
            end
        end
    else
        isPermanentBan = true
        banExpiryTimestamp = 0
        durationTextForKick = PERMANENT_BAN_TEXT
    end

    local banDataToSave = {
        Reason = reason,
        ExpiryTimestamp = banExpiryTimestamp,
        BannedBy = adminPlayer.UserId,
        AdminName = adminPlayer.Name,
        BanDate = os.time()
    }

    local targetUserIdStr = tostring(targetPlayer.UserId)
    local successSave, errSave = pcall(function()
        banDataStore:SetAsync(targetUserIdStr, banDataToSave)
    end)

    if not successSave then
        warn(string.format("Failed to save persistent ban data for %s (ID: %s): %s", targetPlayer.Name, targetUserIdStr, tostring(errSave)))
    else
        local expiryDateStr = "Permanent"
        if banExpiryTimestamp ~= 0 then
            local dateTable = os.date("!*t", banExpiryTimestamp) 
            expiryDateStr = string.format("%04d-%02d-%02d %02d:%02d:%02d UTC", dateTable.year, dateTable.month, dateTable.day, dateTable.hour, dateTable.min, dateTable.sec)
        end
        print(string.format("Ban data saved for %s (ID: %s). Reason: %s. Expires: %s.", targetPlayer.Name, targetUserIdStr, reason, expiryDateStr))
    end
    
    -- Instead of kicking, apply ban place measures immediately
    if targetPlayer.Character then
        applyBanToCharacter(targetPlayer, targetPlayer.Character, banDataToSave, durationTextForKick)
    else
        targetPlayer:Kick(string.format("You have been banned.\nReason: %s\nDuration: %s\nRejoin to be moved to the ban area.", reason, durationTextForKick))
    end
    print(string.format("Banning player %s (banned by %s). Reason: %s. Duration: %s. They will be moved to ban place.", targetPlayer.Name, adminPlayer.Name, reason, durationTextForKick))
end

-- Function to handle the unban command
processUnbanCommand = function(adminPlayer, argumentsString)
    if not isPlayerAdmin(adminPlayer) then -- Only full admins can unban
        print(adminPlayer.Name .. " (ID: " .. adminPlayer.UserId .. ") attempted to use unban command. This command is Admin-only.")
        return
    end

    local parts = {}
    for part in string.gmatch(argumentsString, "[^%s]+") do
        table.insert(parts, part)
    end

    if #parts < 1 then
        print(adminPlayer.Name .. " used an incomplete unban command. Usage: <PlayerNameOrID>")
        return
    end

    local targetIdentifier = parts[1] 
    local targetUserId

    local idCheck = tonumber(targetIdentifier)
    if idCheck and math.floor(idCheck) == idCheck and idCheck > 0 then
        targetUserId = idCheck
    else
        local success, userIdOrError = pcall(function()
            return Players:GetUserIdFromNameAsync(targetIdentifier)
        end)
        if success and userIdOrError then
            targetUserId = userIdOrError
        else
            print(string.format("Admin %s: Failed to get UserId for player name '%s'. Error: %s", adminPlayer.Name, targetIdentifier, success and "Name not found or invalid" or tostring(userIdOrError)))
            return
        end
    end

    if not targetUserId then
        print(string.format("Admin %s: Could not resolve '%s' to a valid UserId for unban.", adminPlayer.Name, targetIdentifier))
        return
    end

    local userIdStr = tostring(targetUserId)
    local currentBanData
    local successGet, resultGet = pcall(function()
        currentBanData = banDataStore:GetAsync(userIdStr)
    end)

    if not successGet then
        warn(string.format("Admin %s: Error checking existing ban for %s (ID: %s) before unbanning: %s", adminPlayer.Name, targetIdentifier, userIdStr, tostring(resultGet)))
    end

    if not currentBanData and successGet then
        print(string.format("Admin %s: No active ban found for %s (ID: %s). No action taken.", adminPlayer.Name, targetIdentifier, userIdStr))
        return
    end
    
    local successRemove, errorRemove = pcall(function()
        banDataStore:RemoveAsync(userIdStr)
    end)

    if successRemove then
        print(string.format("Admin %s: Successfully unbanned %s (ID: %s). Their ban record has been removed.", adminPlayer.Name, targetIdentifier, userIdStr))
        -- If player is online, remove ban UI and restore movement
        local onlinePlayer = Players:GetPlayerByUserId(targetUserId)
        if onlinePlayer then
            local playerGui = onlinePlayer:FindFirstChild("PlayerGui")
            if playerGui then
                local banGui = playerGui:FindFirstChild("BanInfoGui")
                if banGui then banGui:Destroy() end
            end
            if onlinePlayer.Character then
                local humanoid = onlinePlayer.Character:FindFirstChildOfClass("Humanoid")
                if humanoid then
                    humanoid.WalkSpeed = 16 -- Default
                    humanoid.JumpPower = 50 -- Default
                end
                -- Optionally teleport them to a default spawn
                local spawnLocations = Workspace:GetChildren()
                for _, spawn in ipairs(spawnLocations) do
                    if spawn:IsA("SpawnLocation") and spawn.Enabled then
                        onlinePlayer.Character:PivotTo(spawn.CFrame + Vector3.new(0,3,0))
                        break
                    end
                end
            end
            print(string.format("Player %s is online, ban effects removed.", onlinePlayer.Name))
        end
    else
        warn(string.format("Admin %s: Failed to remove ban for %s (ID: %s) from DataStore. Error: %s", adminPlayer.Name, targetIdentifier, userIdStr, tostring(errorRemove)))
    end
end

-- Function to handle the bring command
processBringCommand = function(adminPlayer, argumentsString)
    if not canPlayerUseGeneralCommands(adminPlayer) then
        print(adminPlayer.Name .. " (ID: " .. adminPlayer.UserId .. ") attempted to use bring command without permission.")
        return
    end

    local parts = {}
    for part in string.gmatch(argumentsString, "[^%s]+") do
        table.insert(parts, part)
    end

    if #parts < 1 then
        print(adminPlayer.Name .. " used an incomplete bring command. Usage: <PlayerName>")
        return
    end

    local targetPlayerName = parts[1]
    local targetPlayer = findPlayerByPartialName(targetPlayerName, adminPlayer)

    if not targetPlayer then
        return
    end

    if targetPlayer == adminPlayer then
        print(adminPlayer.Name .. " cannot bring themselves.")
        return
    end

    local adminCharacter = adminPlayer.Character
    if not adminCharacter then
        print(adminPlayer.Name .. " tried to bring, but their character was not found.")
        return
    end
    local adminRoot = adminCharacter:FindFirstChild("HumanoidRootPart")
    if not adminRoot then
        print(adminPlayer.Name .. " tried to bring, but their HumanoidRootPart was not found.")
        return
    end

    local targetCharacter = targetPlayer.Character
    if not targetCharacter then
        print(adminPlayer.Name .. " tried to bring " .. targetPlayer.Name .. ", but their character was not found.")
        return
    end
    
    local targetRoot = targetCharacter:FindFirstChild("HumanoidRootPart")
    if not targetRoot then
        print(adminPlayer.Name .. " tried to bring " .. targetPlayer.Name .. ", but their HumanoidRootPart was not found.")
        return
    end

    targetCharacter:PivotTo(adminCharacter:GetPivot())
    print(string.format("%s brought %s to their location.", adminPlayer.Name, targetPlayer.Name))
end

-- Function to handle the kick command
processKickCommand = function(adminPlayer, argumentsString)
    if not canPlayerUseGeneralCommands(adminPlayer) then
        print(adminPlayer.Name .. " (ID: " .. adminPlayer.UserId .. ") attempted to use kick command without permission.")
        return
    end

    local parts = {}
    for part in string.gmatch(argumentsString, "[^%s]+") do
        table.insert(parts, part)
    end

    if #parts < 1 then
        print(adminPlayer.Name .. " used an incomplete kick command. Usage: <PlayerName> [Reason...]")
        return
    end

    local targetPlayerName = parts[1]
    local targetPlayer = findPlayerByPartialName(targetPlayerName, adminPlayer)

    if not targetPlayer then
        return
    end

    if targetPlayer == adminPlayer then
        print(adminPlayer.Name .. " cannot kick themselves.")
        return
    end

    local reason = DEFAULT_KICK_REASON
    if #parts >= 2 then
        local reasonWords = {}
        for i = 2, #parts do
            table.insert(reasonWords, parts[i])
        end
        if #reasonWords > 0 then
            reason = table.concat(reasonWords, " ")
        end
    end

    print(string.format("Kicking player %s (kicked by %s). Reason: %s.", targetPlayer.Name, adminPlayer.Name, reason))
    targetPlayer:Kick(reason)
end

-- Function to handle the view command (POV)
processViewCommand = function(adminPlayer, argumentsString)
    if not canPlayerUseGeneralCommands(adminPlayer) then
        print(adminPlayer.Name .. " (ID: " .. adminPlayer.UserId .. ") attempted to use view command without permission.")
        SetViewPOVEvent:FireClient(adminPlayer, nil) 
        return
    end

    local parts = {}
    for part in string.gmatch(argumentsString, "[^%s]+") do
        table.insert(parts, part)
    end

    local targetPlayerInstanceForClient = nil 

    if #parts < 1 then
        print(adminPlayer.Name .. " used an incomplete view command. Usage: :view <PlayerName>")
    else
        local targetPlayerName = parts[1]
        local targetPlayer = findPlayerByPartialName(targetPlayerName, adminPlayer)

        if not targetPlayer then
            print(adminPlayer.Name .. " tried to view '" .. targetPlayerName .. "', but no specific player found or name was ambiguous. Client will stop viewing.")
        elseif targetPlayer == adminPlayer then
            print(adminPlayer.Name .. " cannot view themselves in POV mode. Client will stop viewing.")
        elseif not targetPlayer.Character then
            print(adminPlayer.Name .. " tried to view " .. targetPlayer.Name .. ", but their character was not found. Client will stop viewing.")
        else
            targetPlayerInstanceForClient = targetPlayer
            print(string.format("%s is now attempting to view %s's POV.", adminPlayer.Name, targetPlayer.Name))
        end
    end
    SetViewPOVEvent:FireClient(adminPlayer, targetPlayerInstanceForClient)
end

-- Function to handle the "to" (teleport) command
processToCommand = function(adminPlayer, argumentsString)
    if not canPlayerUseGeneralCommands(adminPlayer) then
        print(adminPlayer.Name .. " (ID: " .. adminPlayer.UserId .. ") attempted to use 'to' command without permission.")
        return
    end

    local adminCharacter = adminPlayer.Character
    if not adminCharacter then
        print(adminPlayer.Name .. " tried to teleport, but their character was not found.")
        return
    end
    local adminRoot = adminCharacter:FindFirstChild("HumanoidRootPart")
    if not adminRoot then
        print(adminPlayer.Name .. " tried to teleport, but their HumanoidRootPart was not found.")
        return
    end

    local parts = {}
    for part in string.gmatch(argumentsString, "[^%s]+") do
        table.insert(parts, part)
    end

    if #parts == 0 then
        print(adminPlayer.Name .. " used an incomplete 'to' command. Usage: :to <PlayerName/PartName/ModelName> OR :to <X> <Y> <Z>")
        return
    end

    if #parts == 3 and tonumber(parts[1]) and tonumber(parts[2]) and tonumber(parts[3]) then
        local x = tonumber(parts[1])
        local y = tonumber(parts[2])
        local z = tonumber(parts[3])
        local destinationCFrame = CFrame.new(x, y, z)
        adminCharacter:PivotTo(destinationCFrame)
        print(string.format("%s teleported to coordinates: %.2f, %.2f, %.2f", adminPlayer.Name, x, y, z))
        return
    end

    local targetName = argumentsString 
    local targetPlayer = findPlayerByPartialName(targetName, adminPlayer)
    if targetPlayer then
        if targetPlayer == adminPlayer then
            print(adminPlayer.Name .. " tried to teleport to themselves.")
            return
        end
        local targetCharacter = targetPlayer.Character
        if targetCharacter then
            adminCharacter:PivotTo(targetCharacter:GetPivot())
            print(string.format("%s teleported to player %s.", adminPlayer.Name, targetPlayer.Name))
        else
            print(string.format("%s tried to teleport to %s, but their character was not found.", adminPlayer.Name, targetPlayer.Name))
        end
        return
    end

    local targetInstance = Workspace:FindFirstChild(targetName)
    if targetInstance then
        local destinationPosition
        if targetInstance:IsA("BasePart") then
            destinationPosition = targetInstance.Position + Vector3.new(0, 3, 0) 
            adminCharacter:PivotTo(CFrame.new(destinationPosition))
            print(string.format("%s teleported to Part: %s.", adminPlayer.Name, targetInstance.Name))
            return
        elseif targetInstance:IsA("Model") then
            destinationPosition = targetInstance:GetPivot().Position + Vector3.new(0, 5, 0) 
            adminCharacter:PivotTo(CFrame.new(destinationPosition))
            print(string.format("%s teleported to Model: %s.", adminPlayer.Name, targetInstance.Name))
            return
        else
            print(string.format("%s tried to teleport to '%s', which is not a Player, Part, or Model.", adminPlayer.Name, targetName))
        end
    else
        print(string.format("%s tried to teleport to '%s', but no player, part, or model with that name was found.", adminPlayer.Name, targetName))
    end
end

onPlayerAdded = function(player)
    local canProceedInitially = checkPlayerBan(player) -- Handles initial ban check and ban place setup

    if player.Parent then -- Player still in game
        if canProceedInitially then
            -- Player is not banned, setup admin/mod chat commands
            player.Chatted:Connect(function(message)
                if not (isPlayerAdmin(player) or isPlayerMod(player)) then return end -- Only admins or mods can use chat commands
                local words = {}
                for word in string.gmatch(message, "[^%s]+") do table.insert(words, word) end
                if #words == 0 then return end
                local commandPrefixChat = words[1]:lower() 
                local arguments = ""
                if #words > 1 then
                    local argParts = {}
                    for i = 2, #words do table.insert(argParts, words[i]) end
                    arguments = table.concat(argParts, " ")
                end
                if commandPrefixChat == BAN_COMMAND_PREFIX or commandPrefixChat == BAN_COMMAND_PREFIX:sub(2) then pcall(processBanCommand, player, arguments)
                elseif commandPrefixChat == UNBAN_COMMAND_PREFIX or commandPrefixChat == UNBAN_COMMAND_PREFIX:sub(2) then pcall(processUnbanCommand, player, arguments)
                elseif commandPrefixChat == BRING_COMMAND_PREFIX or commandPrefixChat == BRING_COMMAND_PREFIX:sub(2) then pcall(processBringCommand, player, arguments)
                elseif commandPrefixChat == KICK_COMMAND_PREFIX or commandPrefixChat == KICK_COMMAND_PREFIX:sub(2) then pcall(processKickCommand, player, arguments)
                elseif commandPrefixChat == VIEW_COMMAND_PREFIX or commandPrefixChat == VIEW_COMMAND_PREFIX:sub(2) then pcall(processViewCommand, player, arguments)
                elseif commandPrefixChat == TO_COMMAND_PREFIX or commandPrefixChat == TO_COMMAND_PREFIX:sub(2) then pcall(processToCommand, player, arguments)
                end
            end)
        end

        -- Handle respawns for banned players or cleanup for expired bans
        player.CharacterAdded:Connect(function(character)
            task.wait(0.2) -- Allow character to fully load and initial ban check to complete

            local userIdStr = tostring(player.UserId)
            local banData
            local success, result = pcall(function() banData = banDataStore:GetAsync(userIdStr) end)

            if not success then
                warn("Failed to re-check ban status on respawn for " .. player.Name .. ": " .. tostring(result))
                return
            end

            if banData then
                local isPermanent = (banData.ExpiryTimestamp == 0)
                local isExpired = not isPermanent and (os.time() > banData.ExpiryTimestamp)
                local currentDurationDisplay = ""

                if not isExpired then -- Still banned
                    if isPermanent then currentDurationDisplay = PERMANENT_BAN_TEXT
                    else
                        local remainingSeconds = banData.ExpiryTimestamp - os.time()
                        if remainingSeconds <= 0 then isExpired = true 
                        else
                            local remainingMinutes = math.ceil(remainingSeconds / 60)
                            currentDurationDisplay = remainingMinutes .. " minute(s) remaining"
                        end
                    end
                    if not isExpired then -- Re-check after duration calc
                         applyBanToCharacter(player, character, banData, currentDurationDisplay)
                    end
                end
                
                if isExpired then 
                    print(string.format("Ban for %s (ID: %s) found expired on respawn. Cleaning up.", player.Name, userIdStr))
                    local playerGui = player:FindFirstChild("PlayerGui")
                    if playerGui then
                        local banGui = playerGui:FindFirstChild("BanInfoGui")
                        if banGui then banGui:Destroy() end
                    end

                    local humanoid = character:FindFirstChildOfClass("Humanoid")
                    if humanoid then
                        humanoid.WalkSpeed = 16 
                        humanoid.JumpPower = 50 
                    end
                    
                    local remSuccess, remErr = pcall(function() banDataStore:RemoveAsync(userIdStr) end)
                    if not remSuccess then
                        warn(string.format("Failed to remove expired ban data on respawn for %s (ID: %s): %s", player.Name, userIdStr, tostring(remErr)))
                    end
                end
            else -- No ban data found
                local playerGui = player:FindFirstChild("PlayerGui")
                if playerGui then
                    local banGui = playerGui:FindFirstChild("BanInfoGui")
                    if banGui then banGui:Destroy() end
                end
                local humanoid = character:FindFirstChildOfClass("Humanoid")
                if humanoid then
                    if humanoid.WalkSpeed == 0 then humanoid.WalkSpeed = 16 end
                    if humanoid.JumpPower == 0 then humanoid.JumpPower = 50 end
                end
            end
        end)
    end
end

Players.PlayerAdded:Connect(onPlayerAdded)
for _, player in ipairs(Players:GetPlayers()) do
    task.spawn(onPlayerAdded, player)
end

AdminCommandEvent.OnServerEvent:Connect(function(adminPlayer, commandText)
    local commandWords = {}
    for word in string.gmatch(commandText, "[^%s]+") do table.insert(commandWords, word) end
    if #commandWords == 0 then 
        print("AdminCommandEvent received empty command from " .. adminPlayer.Name) 
        return 
    end
    local commandAction = commandWords[1]:lower() 
    local arguments = ""
    if #commandWords > 1 then
        local argParts = {}
        for i = 2, #commandWords do 
            table.insert(argParts, commandWords[i])
        end
        arguments = table.concat(argParts, " ")
    end

    local role = "User"
    if isPlayerAdmin(adminPlayer) then
        role = "Admin"
    elseif isPlayerMod(adminPlayer) then
        role = "Mod"
    end

    print(string.format("AdminCommandEvent: Player %s (Role: %s), Action '%s', Arguments '%s'", 
        adminPlayer.Name, role, commandAction, arguments))

    if commandAction == BAN_COMMAND_PREFIX or commandAction == BAN_COMMAND_PREFIX:sub(2) then pcall(processBanCommand, adminPlayer, arguments)
    elseif commandAction == UNBAN_COMMAND_PREFIX or commandAction == UNBAN_COMMAND_PREFIX:sub(2) then pcall(processUnbanCommand, adminPlayer, arguments)
    elseif commandAction == BRING_COMMAND_PREFIX or commandAction == BRING_COMMAND_PREFIX:sub(2) then pcall(processBringCommand, adminPlayer, arguments)
    elseif commandAction == KICK_COMMAND_PREFIX or commandAction == KICK_COMMAND_PREFIX:sub(2) then pcall(processKickCommand, adminPlayer, arguments)
    elseif commandAction == VIEW_COMMAND_PREFIX or commandAction == VIEW_COMMAND_PREFIX:sub(2) then pcall(processViewCommand, adminPlayer, arguments)
    elseif commandAction == TO_COMMAND_PREFIX or commandAction == TO_COMMAND_PREFIX:sub(2) then pcall(processToCommand, adminPlayer, arguments)
    else print(string.format("AdminCommandEvent: Unknown command action '%s' from %s", commandAction, adminPlayer.Name))
    end
end)

if RequestBanAppealEvent then
    RequestBanAppealEvent.OnServerEvent:Connect(function(requestingPlayer)
        local userIdStr = tostring(requestingPlayer.UserId)
        local banData
        local success, result = pcall(function() banData = banDataStore:GetAsync(userIdStr) end)
        
        local reason = "Unknown (or no active ban at time of appeal)"
        if success and banData then
            reason = banData.Reason or DEFAULT_BAN_REASON
        elseif not success then
            reason = "Error fetching ban details for appeal: " .. tostring(result)
        end

        print(string.format("Ban appeal REQUESTED by: %s (ID: %s). Original Ban Reason (if found): %s", 
            requestingPlayer.Name, userIdStr, reason))
        -- Consider logging this to an external service or a separate DataStore for review.
    end)
else
    warn("RequestBanAppealEvent RemoteEvent not found in ReplicatedStorage. Ban appeals will not be processed.")
end

print("Admin/Mod Command script loaded with role-based permissions and ban place system.")
print("Chat Usage (Ban): :ban <PlayerName> [DurationInMinutes/perm] [Reason...]")
print("Chat Usage (Unban - Admin Only): :unban <PlayerNameOrID>")
print("Chat Usage (Bring): :bring <PlayerName>")
print("Chat Usage (Kick): :kick <PlayerName> [Reason...]")
print("Chat Usage (View): :view <PlayerName>")
print("Chat Usage (To): :to <PlayerName/PartName/ModelName> OR :to <X> <Y> <Z>")

game:BindToClose(function()
    if RunService:IsStudio() then
        print("Game closing (Studio), waiting 2s for DataStore operations...")
        task.wait(2) 
        print("Wait complete, exiting.")
    end
end)
