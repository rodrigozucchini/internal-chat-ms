import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;

const jwks = new JwksClient({
  jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`,
});

function getSigningKey(kid: string): Promise<string> {
  return new Promise((resolve, reject) => {
    jwks.getSigningKey(kid, (err, key) => {
      if (err || !key) return reject(err ?? new Error('Clave de firma no encontrada'));
      resolve(key.getPublicKey());
    });
  });
}

// express-oauth2-jwt-bearer hace esto automático para requests HTTP.
// El handshake de un socket no pasa por middleware de Express, así que
// para validar el JWT ahí hay que llamar esto a mano.
export async function verifyAuth0Token(token: string): Promise<jwt.JwtPayload> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
    throw new Error('Token malformado');
  }

  const signingKey = await getSigningKey(decoded.header.kid);

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      signingKey,
      { audience: AUTH0_AUDIENCE, issuer: `https://${AUTH0_DOMAIN}/`, algorithms: ['RS256'] },
      (err, payload) => {
        if (err || !payload || typeof payload === 'string') {
          return reject(err ?? new Error('Token inválido'));
        }
        resolve(payload);
      },
    );
  });
}
