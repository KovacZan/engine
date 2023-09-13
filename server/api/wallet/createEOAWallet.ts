import { Static, Type } from "@sinclair/typebox";
import { AwsKmsWallet } from "@thirdweb-dev/wallets/evm/wallets/aws-kms";
import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import {
  addWalletDataWithSupportChainsNonceToDB,
  connectToDatabase,
  env,
} from "../../../core";
import { standardResponseSchema } from "../../helpers/sharedApiSchemas";
import {
  createAWSKMSWallet,
  createGCPKMSWallet,
  getGCPKeyWalletAddress,
} from "../../helpers/wallets";
import { WalletConfigType } from "../../schemas/wallet";

// INPUTS

const requestBodySchema = Type.Object({
  walletType: Type.String({
    description: "Wallet Type",
    examples: ["aws_kms", "gcp_kms"],
  }),
});

requestBodySchema.examples = [
  {
    walletType: "aws_kms",
  },
  {
    walletType: "gcp_kms",
  },
];

// OUTPUT
const responseSchema = Type.Object({
  result: Type.Object({
    walletAddress: Type.String(),
    status: Type.String(),
  }),
});

responseSchema.example = {
  result: {
    walletAddress: "0x....",
    status: "success",
  },
};

export async function createEOAWallet(fastify: FastifyInstance) {
  fastify.route<{
    Reply: Static<typeof responseSchema>;
    Body: Static<typeof requestBodySchema>;
  }>({
    method: "POST",
    url: "/wallet/create",
    schema: {
      description: "Create EOA wallet as backend wallet",
      tags: ["Wallet"],
      operationId: "wallet_create",
      body: requestBodySchema,
      response: {
        ...standardResponseSchema,
        [StatusCodes.OK]: responseSchema,
      },
    },
    handler: async (request, reply) => {
      let wallet: AwsKmsWallet | undefined;
      let awsKmsArn = undefined;
      let awsKmsKeyId = undefined;
      let gcpKmsKeyId = undefined;
      let gcpKmsKeyRingId = undefined;
      let gcpKmsLocationId = undefined;
      let gcpKmsKeyVersionId = undefined;
      let gcpKmsResourcePath = undefined;
      let walletAddress = "";

      const { walletType } = request.body;

      request.log.info(`walletType: ${walletType}`);

      if (walletType === WalletConfigType.aws_kms) {
        if (
          !env.AWS_REGION ||
          !env.AWS_ACCESS_KEY_ID ||
          !env.AWS_SECRET_ACCESS_KEY
        ) {
          throw new Error(
            "AWS_REGION or AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY is not defined. Please check .env file",
          );
        }

        const { keyId, arn } = await createAWSKMSWallet(
          fastify,
          "Web3 API KMS Admin Wallet",
        );

        awsKmsArn = arn;
        awsKmsKeyId = keyId;

        const wallet = new AwsKmsWallet({
          region: env.AWS_REGION!,
          accessKeyId: env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
          keyId,
        });

        walletAddress = await wallet.getAddress();
      } else if (walletType === WalletConfigType.gcp_kms) {
        const cryptoKeyId = `ec-web3api-${new Date().getTime()}`;
        const key = await createGCPKMSWallet(cryptoKeyId);
        gcpKmsKeyId = cryptoKeyId;
        gcpKmsKeyRingId = env.GOOGLE_KMS_KEY_RING_ID;
        gcpKmsLocationId = env.GOOGLE_KMS_LOCATION_ID;
        const { ["walletAddress"]: gcpCreatedWallet, keyVersionId } =
          await getGCPKeyWalletAddress(gcpKmsKeyId);
        gcpKmsKeyVersionId = keyVersionId;
        gcpKmsResourcePath = key.name! + "/cryptoKeysVersion/1";
        walletAddress = gcpCreatedWallet;
      }

      const dbInstance = await connectToDatabase();
      await addWalletDataWithSupportChainsNonceToDB(
        fastify,
        dbInstance,
        false,
        walletAddress,
        {
          walletType,
          awsKmsArn,
          awsKmsKeyId,
          gcpKmsKeyId,
          gcpKmsKeyRingId,
          gcpKmsLocationId,
          gcpKmsKeyVersionId,
          gcpKmsResourcePath,
        },
      );
      await dbInstance.destroy();
      reply.status(StatusCodes.OK).send({
        result: {
          walletAddress,
          status: "success",
        },
      });
    },
  });
}
