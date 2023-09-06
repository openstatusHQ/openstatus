/**
 * @swagger
 * /v1/incidents:
 *   post:
 *     description: Create a new incident
 *     responses:
 *       200:
 *         description: Hello World!
 *     tags:
 *        - Incidents
 */
export async function POST(_request: Request) {
  // Do whatever you want
  return new Response("Hello World!", {
    status: 200,
  });
}
