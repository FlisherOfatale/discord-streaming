/*
Streaming Highligh Module for DiscordJS
Author: Flisher (andre@jmle.net)

// Todo: 
	Add randomness in the minutes for the cron task
	Add a limit of actions per minutes
	Add muti roles capability per server
*/

module.exports = async (client, options) => {
	const cron = require('node-cron');

	const description = {
		name: `discord-Streaming`,
		filename: `discord-streaming.js`,
		version: `3.0.0`
	}

	let Ready = false
	const debug = false

	console.log(`Module: ${description.name} | Loaded - version ${description.version} from ("${description.filename}")`)
	const DiscordJSversion = require("discord.js").version.substring(0, 2)

	if (DiscordJSversion === '11') console.error("This version of discord-Streaming only run on DiscordJS V13 and up, please run \"npm i discord-playing@discord.js-v11\" to install an older version")
	if (DiscordJSversion === '12') console.error("This version of discord-Streaming only run on DiscordJS V13 and up, please run \"npm i discord-playing@discord.js-v12\" to install an older version")
	if (DiscordJSversion !== '13') return

	// Check that required Gateway Intention
	const {
		Intents
	} = require('discord.js');
	const liveIntent = new Intents(client.options.intents)
	const requiredIntent = ['GUILD_PRESENCES', 'GUILDS', 'GUILD_MEMBERS']
	const gotAllIntent = liveIntent.has(requiredIntent)

	if (gotAllIntent) {
		init(client, options)
	} else {
		console.log(`Module: ${description.name} | Version ${description.version} NOT initialized due to the following reasons ")`)
		for (let i in requiredIntent) {
			let checkedIntent = requiredIntent[i]
			if (!liveIntent.has(requiredIntent[i])) {
				console.log(`Module: ${description.name} | Missing Gateway Intent ${requiredIntent[i]}`)
			}
		}
	}

	if (!options) {
		options = {};
	}

	if (debug) console.log(`Module: ${description.name} | DEBUG | TURNED ON`)


	function init(client, options) {
		if (debug) console.log(`Module: ${description.name} | DEBUG | init start`)
		// Add check on startup and intialize the Ready Value
		if (debug) console.log(`Module: ${description.name} | DEBUG | init - options.AlreadyReady: ${options.AlreadyReady}`)
		if (options.AlreadyReady === true) {
			onReady()
			delete options.AlreadyReady
		} else {
			client.on("ready", () => {
				onReady()
			});
		}
	}

	async function onReady() {
		Ready = true;
		if (debug) console.log(`Module: ${description.name} | onReady ${Ready}`)
	}

	// Add a Cron job every minutes
	let jobStreamingCheck = new cron.schedule('*/3 * * * * *', function () { // check 10 seeconds
		if (debug) console.log(`Module: ${description.name} | jobStreamingCheck - Ready ${Ready}`)
		if (!Ready) return;
		Check(client, options);
	});

	async function Check(client, options) {
		if (debug) console.log(`Module: ${description.name} | DEBUG | Check start  - Ready ${Ready}`)
		if (!Ready) return;
		Ready = false

		if (options && options.live) {
			// Single Server Config, will default to first guild found in the bot
			let guild = client.guilds.cache.first();
			await StreamingLive(guild, options)
			await StreamingNotLive(guild, options)
		} else {
			// Multi-Servers Config
			for (let key in options) {
				// check that guild is loaded			
				let guild = client.guilds.cache.get(key);
				if (guild) {
					await StreamingLive(guild, options[key])
					await StreamingNotLive(guild, options[key])
				} else {
					console.log(`${description.name} -> Check - Bot isn't connected to Guild "${key}"`)
				}
			}
		}
		Ready = true
	}

	function gotRequiredRole(member, requiredRole) {
		if (debug) console.log(`Module: ${description.name} | DEBUG | gotRequiredRole start`)

		let returnValue = false
		try {
			if (typeof requiredRole !== "undefined" && member && member.roles && member.roles.cache) {
				returnValue = (typeof (member.roles.cache.find(val => val.name === requiredRole || val.id === requiredRole)) !== "undefined")
			} else {
				returnValue = true
			}
		} catch (e) {
			console.error(`${description.name} -> StreamingLive - Bot failed the gotRequiredRole function for ${member} of guild ${member.guild} / ${member.guild.id} )`);
			console.error(e)
		}
		return returnValue
	}

	async function addRole(member, role) {
		if (debug) console.log(`Module: ${description.name} | DEBUG | addRole start`)

		let actionTaken = false
		try {
			if (!member.roles.cache.find(val => val.name === role || val.id === role)) {
				let resolvableRole = member.guild.roles.cache.find(val => val.name === role || val.id === role)
				await member.roles.add(resolvableRole)
				actionTaken = true
			} else {
				// Do Nothing
			}
		} catch (e) {
			console.error(`${description.name} -> StreamingLive - Bot could not assign role to ${member} of guild ${member.guild} / ${member.guild.id} )`);
			console.error(e)
		}
		return actionTaken
	}


	async function removeRole(member, role) {
		if (debug) console.log(`Modul e: ${description.name} | DEBUG | removeRole start`)

		let actionTaken = false
		try {
			if (member.roles.cache.find(val => val.name === role || val.id === role)) {
				let resolvableRole = member.guild.roles.cache.find(val => val.name === role || val.id === role)
				await member.roles.remove(resolvableRole)
				actionTaken = true
			} else {
				// Do Nothing
			}
		} catch (e) {
			console.error(`${description.name} -> StreamingLive - Bot could not remove role to ${member} of guild ${member.guild} / ${member.guild.id} )`);
			console.error(e)
		}
		return actionTaken
	}



	async function StreamingLive(guild, options) {
		if (debug) console.log(`Module: ${description.name} | DEBUG | StreamingLive start`)

		// Check if the bot can manage Roles for this guild
		if (guild.me.permissions.has("MANAGE_ROLES")) {
			// Loop trough presence to find streamers (type 1)
			let presences = guild.presences;
			let actionAlreadyTaken = false
			if (presences) {
				// presences.cache.forEach(async function (element, key) {	
				for (let [key, element] of presences.cache) {
					if (!actionAlreadyTaken) { // This check will skip the elements if an action was already taken, it's to prevent API spam when too many status need to be updated
						// Loop trought presence within the cache
						if (typeof element.activities !== undefined) { // element.activities will be set only if there is 1 or more activities active
							// The activities list is an array, needing to parse trought it
							for (let activityKey in element.activities) {
								let activity = element.activities[activityKey]
								if (activity && activity.type === "STREAMING") {
									let member = element.guild.members.cache.get(key)
									if (gotRequiredRole(member, options.required)) {
										actionAlreadyTaken = await addRole(member, options.live)
									}
								}
							}
						}
					}
				}
			}
		} else {
			console.error(`${description.name} -> StreamingLive - Bot doesn't have "MANAGE_ROLES" permission on Guild "${guild.name}" (${guild.id})`);
		}
	}

	async function StreamingNotLive(guild, options) {
		if (debug) console.log(`Module: ${description.name} | DEBUG | StreamingNotLive - start`)

		// Check if the bot can manage Roles for this guild
		if (guild.me.permissions.has("MANAGE_ROLES")) {
			// Loop trough presence to find streamers (type 1)
			let StreamingMembers = guild.roles.cache.find(val => val.name === options.live).members
			let actionAlreadyTaken = false // This check will skip the elements if an action was already taken, it's to prevent API spam when too many status need to be updated
			for (let [memberid, member] of StreamingMembers) {
				if (!actionAlreadyTaken) {
					let isStreamingLive = false
					if (member.presence && typeof member.presence.activities !== undefined && Object.keys(member.presence.activities).length > 0) {
						// Need to iterate activities
						for (let activityKey in member.presence.activities) {
							let activity = member.presence.activities[activityKey]
							if (activity && activity.type === "STREAMING") {
								isStreamingLive = true
							}
						}
					} else {
						// No activity, the member isn't streaming anymore
					}
					if (!isStreamingLive) actionAlreadyTaken = await removeRole(member, options.live)
				}
			}
		} else {
			console.error(`${description.name} -> StreamingLive - Bot doesn't have "MANAGE_ROLES" permission on Guild "${guild.name}" (${guild.id})`);
		}
	}
}