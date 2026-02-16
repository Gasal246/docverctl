import { loadEnvConfig } from "@next/env";

function getArg(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  loadEnvConfig(process.cwd());

  const githubUserIdRaw = getArg("--id");
  const githubLogin = getArg("--login");
  const isAdmin = getArg("--admin") !== "false";

  if (!githubUserIdRaw || !githubLogin) {
    throw new Error("Usage: npm run seed:admin -- --id <githubUserId> --login <githubLogin> [--admin true|false]");
  }

  const githubUserId = Number(githubUserIdRaw);
  if (!Number.isFinite(githubUserId)) {
    throw new Error("--id must be a valid number");
  }

  const [{ connectToDatabase }, { AllowedUserModel }] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/models")
  ]);

  await connectToDatabase();

  await AllowedUserModel.updateOne(
    { githubUserId },
    {
      $set: {
        githubLogin: githubLogin.toLowerCase(),
        isAdmin,
        addedBy: "bootstrap-script",
        addedAt: new Date()
      }
    },
    { upsert: true }
  );

  console.log(`Bootstrapped ${githubLogin} (${githubUserId}) as ${isAdmin ? "admin" : "member"}`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
