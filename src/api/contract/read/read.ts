import { FastifyInstance } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { Static } from '@sinclair/typebox';
import { getSDK } from '../../../helpers/sdk';
import { partialRouteSchema, schemaTypes } from '../../../sharedApiSchemas';
import { logger } from '../../../utilities/logger';
import { readRequestQuerySchema } from '../../../schemas/contract/read';

interface readSchema extends schemaTypes {
  Querystring: Static<typeof readRequestQuerySchema>;
}

export async function readContract(fastify: FastifyInstance) {
  fastify.route<readSchema>({
    method: 'GET',
    url: '/contract/:chain_name_or_id/:contract_address/read',
    schema: {
      description: 'Read From Contract',
      tags: ['Contract'],
      operationId: 'read',
      ...partialRouteSchema,
      querystring: readRequestQuerySchema,
    },
    handler: async (request, reply) => {
      const { chain_name_or_id, contract_address } = request.params;
      const { function_name, args } = request.query;
      logger.info('Inside Read Function');
      logger.silly(`Chain : ${chain_name_or_id}`)
      logger.silly(`Contract Address : ${contract_address}`);

      logger.silly(`Function Name : ${function_name}`)
      logger.silly(`Args : ${args}`);

      const sdk = await getSDK(chain_name_or_id);
      const contract = await sdk.getContract(contract_address);

      const returnData: any = await contract.call(function_name, args ? args.split(',') : []);
      
      reply.status(StatusCodes.OK).send({
        result: {
          data: returnData
        },
        error: null,
      });
    },
  });
}
