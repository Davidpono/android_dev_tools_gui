const electron = require("electron");
const { app, BrowserWindow, dialog } = electron;
const cp = require("child_process");

let mainWindow;
let deviceIP;

app.on("ready", () => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 1200,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
    });

    mainWindow.loadFile("index.html");
});

electron.ipcMain.on("inputSubmitted", (event, arg) => {
    mainWindow.webContents.send("update-textbox", arg);
});
electron.ipcMain.on("openFileDialog", openFileDialog);
electron.ipcMain.on("connectDevice", (event, arg) => {
    connectDevice(arg);
});
electron.ipcMain.on("disconnectDevice", disconnectDevice);
electron.ipcMain.on("checkDevices", checkDevices);
electron.ipcMain.on("installApk", (event, arg) => {
    installApk(arg);
});
electron.ipcMain.on("startApk", (event, arg) => {
    console.log("start");
    startApk(arg);
});
electron.ipcMain.on("stopApk", (event, arg) => {
    console.log("stop");
    stopApk(arg);
});
electron.ipcMain.on("clearApk", (event, arg) => {
    console.log("clear");
    clearApk(arg);
});
electron.ipcMain.on("uninstallApk", (event, arg) => {
    console.log("uninstall");
    uninstallApk(arg);
});
electron.ipcMain.on("typeTextAction", (event, arg) => {
    console.log("type action!" + arg);
    typeTextAction(arg);
});
electron.ipcMain.on("backspaceAction", backspaceAction);

setInterval(checkDevices, 5000);

async function checkDevices() {
    let defaultMessage;
    let deviceModel;

    cp.spawnSync(`adb devices`, (error, stdout, stderr) => {
        if (error) {
            mainWindow.webContents.send(
                "updateDeviceUnitStatus",
                `No devices found :(`
            );
            return;
        }
        if (stderr) {
            mainWindow.webContents.send(
                "updateDeviceUnitStatus",
                `No devices found :(`
            );
            return;
        }
        // console.log("defaulted?")
        defaultMessage = stdout;

        cp.spawnSync(
            `adb shell ip addr show wlan0 | findstr /r /c:"inet.*[0-9]*\.[0-9]*\.[0-9]*\.[0-9]*" | for /f "tokens=2" %a in ('more') do @echo %a`,
            (error, stdout, stderr) => {
                if (error) {
                    mainWindow.webContents.send(
                        "updateDeviceUnitStatus",
                        `No devices found :(`
                    );
                    return;
                }
                if (stderr) {
                    mainWindow.webContents.send(
                        "updateDeviceUnitStatus",
                        `No devices found :(`
                    );
                    return;
                }
                // console.log("got ip")
                deviceIP = stdout.slice(0, stdout.indexOf("/"));

                cp.spawnSync(
                    `adb -s ${deviceIP} shell getprop ro.product.model  `,
                    (error, stdout, stderr) => {
                        if (error) {
                            mainWindow.webContents.send(
                                "updateDeviceUnitStatus",
                                `No devices found :(`
                            );
                            return;
                        }
                        if (stderr) {
                            mainWindow.webContents.send(
                                "updateDeviceUnitStatus",
                                `No devices found :(`
                            );
                            return;
                        }

                        deviceModel = stdout;
                        // console.log("Got model")

                        if (deviceIP != null || deviceModel != null) {
                            mainWindow.webContents.send(
                                "updateDeviceUnitStatus",
                                `Connected to: ${deviceModel} as "${deviceIP}"`
                            );
                        } else {
                            mainWindow.webContents.send(
                                "updateDeviceUnitStatus",
                                `${defaultMessage}`
                            );
                        }
                    }
                );
            }
        );
    });
}

async function connectDevice(deviceIPAddress) {
    cp.spawnSync(`adb connect ${deviceIPAddress}`, (error, stdout, stderr) => {
        if (error) {
            mainWindow.webContents.send("updateDeviceStatus", `${error}`);
            return;
        }
        if (stderr) {
            mainWindow.webContents.send("updateDeviceStatus", `${stderr}`);
            return;
        }
        mainWindow.webContents.send("updateDeviceStatus", `${stdout}`);
        deviceIP = deviceIPAddress;
        checkDevices();
    });
}

async function disconnectDevice() {
    cp.spawnSync(`adb disconnect`, (error, stdout, stderr) => {
        if (error) {
            mainWindow.webContents.send("updateDeviceStatus", `${error}`);
            return;
        }
        if (stderr) {
            mainWindow.webContents.send("updateDeviceStatus", `${stderr}`);
            return;
        }
        mainWindow.webContents.send("updateDeviceStatus", `${stdout}`);
        deviceIP = null;
        checkDevices();
    });
}

async function installApk(apkPath) {
    cp.spawnSync(`adb install "${apkPath}"`, (error, stdout, stderr) => {
        if (error) {
            mainWindow.webContents.send("updateInstallStatus", `${error}`);
            return;
        }
        if (stderr) {
            mainWindow.webContents.send("updateInstallStatus", `${stderr}`);
            return;
        }
        mainWindow.webContents.send("updateInstallStatus", `${stdout}`);
    });
}

function openFileDialog() {
    dialog
        .showOpenDialog(mainWindow, {
            properties: ["openFile"],
            filters: [
                {
                    name: "APK Files",
                    extensions: ["apk"],
                },
            ],
        })
        .then((result) => {
            if (!result.canceled) {
                const apkPath = result.filePaths[0];
                mainWindow.webContents.send("updateDirectory", apkPath);
            }
        })
        .catch((err) => {
            mainWindow.webContents.send(
                "updateInstallStatus",
                `Error opening file dialog: ${err.message}`
            );
        });
}

async function startApk(apkPackage) {
    cp.spawnSync(
        `adb shell monkey -p "${apkPackage}" -c android.intent.category.LEANBACK_LAUNCHER 1`,
        (error, stdout, stderr) => {
            if (error || stderr) {
                cp.spawnSync(
                    `adb shell monkey -p "${apkPackage}" -c android.intent.category.LAUNCHER 1`,
                    (error, stdout, stderr) => {
                        if (error || stderr) {
                            mainWindow.webContents.send(
                                "updateInstallStatus",
                                `${stderr}`
                            );
                            return;
                        }
                        mainWindow.webContents.send(
                            "updateInstallStatus",
                            `${stdout}`
                        );
                    }
                );
                mainWindow.webContents.send("updateInstallStatus", `${stderr}`);
                return;
            }
            mainWindow.webContents.send("updateInstallStatus", `${stdout}`);
        }
    );
}

async function stopApk(apkPackage) {
    cp.spawnSync(
        `adb shell am force-stop ${apkPackage}"`,
        (error, stdout, stderr) => {
            if (error) {
                mainWindow.webContents.send("updateInstallStatus", `${error}`);
                return;
            }
            if (stderr) {
                mainWindow.webContents.send("updateInstallStatus", `${stderr}`);
                return;
            }
            mainWindow.webContents.send("updateInstallStatus", `${stdout}`);
        }
    );
}

async function clearApk(apkPackage) {
    cp.spawnSync(
        `adb shell pm clear ${apkPackage}`,
        (error, stdout, stderr) => {
            if (error) {
                mainWindow.webContents.send("updateInstallStatus", `${error}`);
                return;
            }
            if (stderr) {
                mainWindow.webContents.send("updateInstallStatus", `${stderr}`);
                return;
            }
            mainWindow.webContents.send("updateInstallStatus", `${stdout}`);
        }
    );
}

async function uninstallApk(apkPackage) {
    cp.spawnSync(`adb uninstall ${apkPackage}`, (error, stdout, stderr) => {
        if (error) {
            mainWindow.webContents.send("updateInstallStatus", `${error}`);
            return;
        }
        if (stderr) {
            mainWindow.webContents.send("updateInstallStatus", `${stderr}`);
            return;
        }
        mainWindow.webContents.send("updateInstallStatus", `${stdout}`);
    });
}

async function typeTextAction(inputText) {
    cp.spawnSync(
        `adb shell input text ${inputText}`,
        (error, stdout, stderr) => {}
    );
    mainWindow.webContents.send("updateTypeInputField");
}

async function backspaceAction() {
    cp.spawnSync(`adb shell input keyevent 67`, (error, stdout, stderr) => {});
}
