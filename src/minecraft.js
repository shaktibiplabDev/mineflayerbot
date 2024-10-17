const fs = require("fs");
const path = require("path");
const mineflayer = require("mineflayer");
const {
  host,
  port,
  version,
  username,
  auth,
  prefix,
  silent,
  guarding,
  showCoordinates,
  logging,
  master,
} = require("./settings.json");

const { pathfinder } = require("mineflayer-pathfinder");
const pvp = require("mineflayer-pvp").plugin;

function initialize() {
  const bot = mineflayer.createBot({
    host,
    port,
    version,
    username,
    auth,
    hideErrors: true,
    logErrors: false,
  });

  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);

  bot.config = {
    silent,
    guarding,
    showCoordinates,
    master,
    logging,
  };

  const { commandNames, modules } = injectModules(bot);

  bot.on("chat", (username, message) => {
    if (message === `${prefix}help`) {
      bot.chat(`Commands: ${commandNames.join(", ")}`);
    } else if (message.startsWith(`${prefix}help `)) {
      const commandName = message.substring(6);
      const command = modules.find(
        (module) => module.command && module.command.name === commandName
      )?.command;
      if (command) {
        bot.chat(
          `Usage: ${command.usage} | Description: ${command.description}`
        );
      } else {
        bot.chat(`Command '${commandName}' not found.`);
      }
    }
  });

  bot.once("spawn", () => {
    console.log(
      `\x1b[38;5;208m${"\x1b[33m" + `Mineflayer ready:` + "\x1b[0m"} \x1b[32m${
        bot.username
      }\x1b[0m`
    );
  });

  bot.on("end", () => {
    console.log(
      `\x1b[38;5;208m${
        "\x1b[31m" + `The bot has been disconnected!` + `\x1b[0m`
      }`
    );
    console.log(
      `\x1b[38;5;208m${"\x1b[31m" + `Reconnecting in 5 seconds...` + `\x1b[0m`}`
    );
    setTimeout(initialize, 5000);
  });

  bot.on("death", () => {
    console.log(`\x1b[38;5;208m\x1b[31mBot has died!\x1b[0m`);
    setTimeout(() => {
      console.log(`\x1b[38;5;208m\x1b[32mReinitializing bot...\x1b[0m`);
      initialize(); // Reinitialize the bot on death
    }, 5000);
  });

  // Logic for attacking back if someone attacks the bot
  bot.on('entityHurt', (entity) => {
    if (entity === bot.entity) {
      const attacker = bot.nearestEntity((e) => e.type === 'player' && e !== bot.entity && e.position.distanceTo(bot.entity.position) < 6);
      if (attacker) {
        const sword = bot.inventory.items().find(item => item.name.includes('sword'));
        if (sword) {
          bot.equip(sword, 'hand').then(() => {
            bot.pvp.attack(attacker);
            console.log(`\x1b[33m${bot.username} is attacking back with a sword!\x1b[0m`);
          });
        } else {
          bot.pvp.attack(attacker);
          console.log(`\x1b[33m${bot.username} is attacking back with bare hands!\x1b[0m`);
        }
      }
    }
  });

  return bot;
}

function injectModules(bot) {
  const MODULES_DIRECTORY = path.join(__dirname, "modules");
  const COMMANDS_DIRECTORY = path.join(MODULES_DIRECTORY, "commands");
  const EVENTS_DIRECTORY = path.join(MODULES_DIRECTORY, "events");

  const commandFiles = fs
    .readdirSync(COMMANDS_DIRECTORY)
    .filter((file) => file.endsWith(".js"));
  const commandModules = commandFiles.map((file) =>
    require(path.join(COMMANDS_DIRECTORY, file))
  );

  const eventFiles = fs
    .readdirSync(EVENTS_DIRECTORY)
    .filter((file) => file.endsWith(".js"));
  const eventModules = eventFiles.map((file) =>
    require(path.join(EVENTS_DIRECTORY, file))
  );

  const modules = [...commandModules, ...eventModules];

  const commandNames = commandModules
    .map((module) => module.command)
    .filter((command) => command)
    .map((command) => command.name);

  bot.loadPlugins(modules);

  return { commandNames, modules };
}

module.exports = { initialize };
