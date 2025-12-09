// scripts/verifyLotteryClone.js
const { run, ethers } = require("hardhat");

async function main() {
    // ⚠️ Cambia esta dirección por la lotería recién creada desde tu Factory
    const NEW_LOTTERY_ADDRESS = "0xFd6d4FCB91a797A500c37f3F7Bd24e932C18658A";

    console.log("🔍 Verificando clone de Lotería en Polygonscan...");

    try {
        await run("verify:verify", {
            address: NEW_LOTTERY_ADDRESS,
            constructorArguments: [], // clones NO tienen constructor
        });

        console.log("🎉 Lotería clone verificada exitosamente!");
    } catch (err) {
        if (err.message.includes("Already Verified")) {
            console.log("✔️ La Lotería ya estaba verificada");
        } else {
            console.error("❌ Error verificando la Lotería:", err.message);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });

