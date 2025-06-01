const REMOVE_INFRACTION_ROLE = "1241691063790338108";
const OWNER_ID = "858436607791071263";
const COMMUNITY_MANAGER_ID = "1241691191557230602";

document.addEventListener("DOMContentLoaded", function () {
    const sidebarLinks = document.querySelectorAll('.sidebar nav ul li[data-section]');
    const sections = document.querySelectorAll('.dashboard-section');

    function showSection(section) {
        sections.forEach(sec => sec.classList.remove('active'));
        document.getElementById('section-' + section).classList.add('active');
        sidebarLinks.forEach(link => link.classList.toggle('active', link.dataset.section === section));
    }
    showSection('warning');
    sidebarLinks.forEach(link => link.addEventListener('click', () => showSection(link.dataset.section)));

    // Fetch Discord profile and show/hide Remove/AddMod for correct role
    fetch('/api/me').then(res => res.json()).then(data => {
        if (data && data.avatar && data.username) {
            document.getElementById('discord-avatar').src = data.avatar;
            document.getElementById('discord-username').textContent = data.username + "#" + data.discriminator;
        }
        fetch('/api/roles?discordId=' + data.id)
          .then(res => res.json())
          .then(info => {
              if (info.roles.includes(REMOVE_INFRACTION_ROLE) || data.id === OWNER_ID) {
                  document.querySelector('li[data-section="remove"]').style.display = '';
                  document.getElementById('section-remove').style.display = '';
              }
              if (info.roles.includes(COMMUNITY_MANAGER_ID)) {
                  document.querySelector('li[data-section="addmod"]').style.display = '';
                  document.getElementById('section-addmod').style.display = '';
                  loadMods();
              }
          });
    });

    // Ban form dynamic: show/hide duration field
    const banTypeSelect = document.getElementById('banType');
    const banDurationContainer = document.getElementById('ban-duration-container');
    const banDurationInput = document.getElementById('ban-duration-input');
    if (banTypeSelect) {
        banTypeSelect.addEventListener('change', function () {
            if (this.value === "temporary") {
                banDurationContainer.style.display = '';
                banDurationInput.required = true;
            } else {
                banDurationContainer.style.display = 'none';
                banDurationInput.required = false;
                banDurationInput.value = "";
            }
        });
    }

    function ensureErrorMsgElement(section) {
        let msg = section.querySelector('.form-error-message');
        if (!msg) {
            msg = document.createElement('div');
            msg.className = 'form-error-message';
            msg.style.cssText = 'color:#e55; margin-bottom:1em; font-weight:bold;';
            section.insertBefore(msg, section.querySelector('form'));
        }
        msg.textContent = '';
        return msg;
    }

    document.querySelectorAll('.punishment-form').forEach(form => {
        const section = form.closest('.dashboard-section');
        const errorMsg = ensureErrorMsgElement(section);

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            errorMsg.textContent = '';

            const type = form.dataset.type;
            const data = { type };
            Array.from(form.elements).forEach(input => {
                if (input.name) data[input.name] = input.value;
            });

            if (type === "ban") {
                if (!data.banType) {
                    errorMsg.textContent = 'Please select Ban Type.';
                    return;
                }
                if (data.banType === "temporary" && !data.duration) {
                    errorMsg.textContent = 'Please provide duration for temporary ban.';
                    return;
                }
                if (data.banType === "permanent") {
                    data.duration = "";
                }
            }

            const modal = document.getElementById('confirmation-modal');
            const modalContent = document.getElementById('modal-content');
            modalContent.innerHTML = `
                <h3>Confirm ${type.charAt(0).toUpperCase() + type.slice(1)}</h3>
                <ul style="text-align:left">${Object.entries(data).map(([k,v]) =>
                    `<li><b>${k}</b>: ${v}</li>`).join('')}</ul>
                <button id="confirm-submit">Yes, Submit</button>
                <button id="cancel-submit">Cancel</button>
            `;
            modal.style.display = 'block';
            document.getElementById('confirm-submit').onclick = async () => {
                try {
                    const response = await fetch('/api/log-punishment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data),
                    });

                    const result = await response.json();
                    if (result.success) {
                        modal.style.display = 'none';
                        errorMsg.textContent = '';
                        showSection('logs');
                        loadLogs();
                    } else {
                        errorMsg.textContent = result.error || 'Unknown error';
                    }
                } catch (err) {
                    errorMsg.textContent = 'Failed to submit punishment.';
                } finally {
                    modal.style.display = 'none';
                }
            };
            document.getElementById('cancel-submit').onclick = () => {
                modal.style.display = 'none';
            };
        });
    });

    async function loadLogs() {
        const logsContainer = document.getElementById('logs-container');
        logsContainer.innerHTML = `<span style="color:#aaa">Loading...</span>`;
        try {
            const logs = await fetch('/api/logs').then(r => r.json());
            logsContainer.innerHTML = '';
            if (!logs.length) {
                logsContainer.innerHTML = '<p class="no-logs">No logs yet.</p>';
                return;
            }
            logs.forEach(log => {
                let banTypeText = "";
                if (log.type === "ban") {
                    banTypeText = log.duration ? "Temporary Ban" : "Permanent Ban";
                }
                const div = document.createElement('div');
                div.className = 'log-entry';
                div.innerHTML = `
                    <div class="log-id">ID: #${log.id}</div>
                    <b>${log.type.toUpperCase()}</b>${banTypeText ? " ("+banTypeText+")" : ""}: ${log.username}
                    (<a href="https://www.roblox.com/users/${log.robloxId}/profile" target="_blank">ROBLOX</a>)<br>
                    Reason: ${log.reason || 'N/A'}<br>
                    ${log.evidence ? `Evidence: ${log.evidence}<br>` : ''}
                    ${log.duration ? `Duration: ${log.duration}<br>` : ''}
                    <small>${new Date(log.timestamp).toLocaleString()}</small>
                    ${log.canDelete ? `<button class="delete-button" data-id="${log.id}">Delete</button>` : ''}
                `;
                logsContainer.appendChild(div);
            });
            document.querySelectorAll('.delete-button').forEach(btn => {
                btn.onclick = async function () {
                    if (!confirm('Delete this punishment?')) return;
                    const id = btn.dataset.id;
                    const res = await fetch('/api/delete-infraction', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id })
                    });
                    const result = await res.json();
                    if (result.success) loadLogs();
                    else alert(result.error || 'Not allowed');
                };
            });
        } catch (e) {
            logsContainer.innerHTML = '<p class="error">Failed to load logs.</p>';
        }
    }
    loadLogs();

    document.getElementById('lookup-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        const robloxId = this.elements['robloxId'].value;
        const username = this.elements['username'].value;
        const lookupResults = document.getElementById('lookup-results');
        lookupResults.textContent = '';
        if (!robloxId && !username) {
            lookupResults.innerHTML = '<span class="error">Provide username or Roblox ID.</span>';
            return;
        }
        lookupResults.innerHTML = 'Loading...';
        try {
            const params = new URLSearchParams();
            if (robloxId) params.append('robloxId', robloxId);
            if (username) params.append('username', username);
            const data = await fetch('/api/lookup?' + params).then(r => r.json());
            if (data.error) {
                lookupResults.innerHTML = `<span class="error">${data.error}</span>`;
                return;
            }
            if (data.infractions.length === 0) {
                lookupResults.innerHTML = 'No punishments found.';
                return;
            }
            lookupResults.innerHTML = `<b>User ID:</b> ${data.userId || 'N/A'}<br><br>` +
                data.infractions.map(log => {
                    let banTypeText = "";
                    if (log.type === "ban") {
                        banTypeText = log.duration ? "Temporary Ban" : "Permanent Ban";
                    }
                    return `
                    <div class="log-entry">
                    <div class="log-id">ID: #${log.id}</div>
                    <b>${log.type.toUpperCase()}</b>${banTypeText ? " ("+banTypeText+")" : ""}: ${log.username}
                    (<a href="https://www.roblox.com/users/${log.robloxId}/profile" target="_blank">ROBLOX</a>)<br>
                    Reason: ${log.reason || 'N/A'}<br>
                    ${log.evidence ? `Evidence: ${log.evidence}<br>` : ''}
                    ${log.duration ? `Duration: ${log.duration}<br>` : ''}
                    <small>${new Date(log.timestamp).toLocaleString()}</small>
                    </div>
                `;
                }).join('');
        } catch (e) {
            lookupResults.innerHTML = '<span class="error">Lookup failed.</span>';
        }
    });

    document.getElementById('remove-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        const id = this.elements['id'].value;
        const removeResult = document.getElementById('remove-result');
        removeResult.textContent = '';
        if (!id) return removeResult.innerHTML = 'Provide an ID.';
        removeResult.innerHTML = 'Processing...';
        try {
            const res = await fetch('/api/delete-infraction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const result = await res.json();
            if (result.success) {
                removeResult.innerHTML = 'Punishment removed!';
                loadLogs();
            } else {
                removeResult.innerHTML = `<span style="color:#e55">${result.error || 'Not allowed'}</span>`;
            }
        } catch (e) {
            removeResult.innerHTML = 'Remove failed.';
        }
    });

    // MODERATOR PAGE LOGIC (add/remove)
    function loadMods() {
        fetch('/api/moderators')
        .then(res => res.json())
        .then(mods => {
            const modList = document.getElementById('mod-list');
            if (!mods.length) {
                modList.innerHTML = "<em>No moderators found.</em>";
            } else {
                modList.innerHTML = "<ul>" + mods.map(mod => 
                    `<li><b>${mod.username}</b> (ID: ${mod.robloxId}) <button class="remove-mod-btn" data-id="${mod.robloxId}">Remove</button></li>`
                ).join("") + "</ul>";
            }
            document.querySelectorAll('.remove-mod-btn').forEach(btn => {
                btn.onclick = function() {
                    if (!confirm("Remove this moderator?")) return;
                    fetch('/api/remove-moderator', {
                        method: 'POST',
                        headers: {'Content-Type':'application/json'},
                        body: JSON.stringify({robloxId: btn.dataset.id})
                    }).then(res => res.json()).then(r => {
                        if (r.success) loadMods();
                        else alert(r.error || "Error");
                    });
                }
            });
        });
    }
    if (document.getElementById('add-mod-form')) {
        document.getElementById('add-mod-form').onsubmit = function(e) {
            e.preventDefault();
            const username = this.username.value;
            const robloxId = this.robloxId.value;
            fetch('/api/moderators', {
                method:'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({username, robloxId})
            }).then(res => res.json()).then(r=>{
                if(r.success){
                    document.getElementById('add-mod-result').innerHTML = "Added!";
                    loadMods();
                } else {
                    document.getElementById('add-mod-result').innerHTML = r.error || "Error";
                }
            });
        }
    }

    if (location.hash === '#logs') showSection('logs');
});