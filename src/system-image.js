"use strict";

/*

This file is a part of ubports-installer

Author: Marius Gripsgard <mariogrip@ubports.com>

*/

const fs = require("fs");
const utils = require("./utils");
const adb = require("./adb");
const path = require("path");
const events = require("events")
const mkdirp = require('mkdirp');
const systemImageClient = require("system-image-node-module").Client;

const systemImage = new systemImageClient({path: utils.getUbuntuTouchDir()});
class event extends events {}

const ubuntuCommandFile = "ubuntu_command";

const getDeviceChannels = (device) => {
  return systemImage.getDeviceChannels(device);
}

var downloadLatestVersion = (options) => {
  utils.log.debug("downloadLatestVersion options: ", options);
  var thisEvent;
  if (!options.event)
    thisEvent = new event();
  else
    thisEvent = options.event;
  systemImage.getLatestVersion(options.device, options.channel).then((latest) => {
    var urls = systemImage.getFilesUrlsArray(latest)
    urls.push.apply(urls, systemImage.getGgpUrlsArray());
    var files = systemImage.getFilePushArray(urls);
    files.forEach(file => {
      file.dest = options.ubuntuPushDir
    })
    utils.downloadFiles(urls, thisEvent);
    utils.log.debug(urls);
    thisEvent.once("download:done", () => {
      files.push({
        src: systemImage.createInstallCommandsFile(
          systemImage.createInstallCommands(
            latest.files,
            options.installerCheck,
            options.wipe,
            options.enable
          ),
          options.device
        ),
        dest: options.ubuntuPushDir + ubuntuCommandFile
      });
      thisEvent.emit("download:pushReady", files);
    });
  }).catch(() => {
    thisEvent.emit("error", "could not find latest version; " + "device: " + options.device + " channel: " + options.channel);
  });
  return thisEvent;
}

var pushLatestVersion = (files, thisEvent, options, dontWipeCache /* unused */) => {
  var doPush = () => {
    adb.shell("mount -a", () => {
      adb.shell("mkdir -p " + options.ubuntuPushDir, () => {
        adb.pushMany(files, thisEvent);
      });
    });
  }
  if (dontWipeCache)
    doPush();
  else
    adb.wipeCache(doPush);
  return thisEvent;
}

var installLatestVersion = (options) => {
  var downloadEvent = downloadLatestVersion(options);
  downloadEvent.once("download:pushReady", (files) => {
    pushLatestVersion(files, downloadEvent, options)
  });
  return downloadEvent;
}

module.exports = {
  getDeviceChannels: getDeviceChannels,
  installLatestVersion: installLatestVersion
}
