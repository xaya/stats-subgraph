import {
  Move as MoveEvent,
  Registration as RegistrationEvent,
  Transfer as TransferEvent,
} from "../generated/XayaAccounts/IXayaAccounts"

import {
  Address as AddressEntity,
  Game as GameEntity,
  GameMove as GameMoveEntity,
  Move as MoveEntity,
  Name as NameEntity,
  Namespace as NamespaceEntity,
  Payment as PaymentEntity,
  Registration as RegistrationEntity,
  Transaction as TransactionEntity,
} from "../generated/schema"

import {
  Address,
  BigInt,
  ByteArray,
  Bytes,
  JSONValueKind,
  ethereum,
  json,
} from "@graphprotocol/graph-ts"

/**
 * Converts a token ID given as BigInt to Bytes that can be used
 * as ID in the subgraph.
 */
export function tokenIdToBytes (id: BigInt): Bytes
{
  return Bytes.fromByteArray (ByteArray.fromBigInt (id))
}

/**
 * Constructs a unique ID for an event, based on txhash and log index.
 */
function uniqueIdForEvent (ev: ethereum.Event): Bytes
{
  return ev.transaction.hash.concatI32 (ev.logIndex.toI32 ())
}

/**
 * Creates a Transaction entity if it doesn't exist already.
 */
function maybeCreateTransaction (ev: ethereum.Event): Bytes
{
  const id = ev.transaction.hash
  if (TransactionEntity.load (id) == null)
    {
      const entity = new TransactionEntity (id)
      entity.height = ev.block.number
      entity.timestamp = ev.block.timestamp
      entity.save ()
    }
  return id
}

/**
 * Creates an Address entity if it doesn't exist already.
 */
function maybeCreateAddress (addr: Address): void
{
  if (AddressEntity.load (addr) == null)
    new AddressEntity (addr).save ()
}

/**
 * Creates a Game entity if it doesn't exist already.  Returns the Game instance
 * ID used.
 */
function maybeCreateGame (gid: string): Bytes
{
  const id = Bytes.fromUTF8 (gid)

  if (GameEntity.load (id) == null)
    {
      const entity = new GameEntity (id)
      entity.game = gid
      entity.save ()
    }

  return id
}

/**
 * Tries to parse a move value for a p/ name, and returns all game IDs
 * that it contains (if any).  Returns [] in case of parsing errors or
 * anything else that is invalid.
 */
function getPlayerMoveGames (mv: string): Array<string>
{
  const parsed = json.try_fromString (mv)
  if (parsed.isError)
    return []
  const val = parsed.value
  if (val.kind != JSONValueKind.OBJECT)
    return []
  let obj = val.toObject ()

  const valOrNull = obj.get ("g")
  if (valOrNull == null || valOrNull.kind != JSONValueKind.OBJECT)
    return []
  obj = valOrNull.toObject ()

  const res = new Array<string> (obj.entries.length)
  for (let i = 0; i < obj.entries.length; ++i)
    res[i] = obj.entries[i].key

  return res
}

export function handleMove (ev: MoveEvent): void
{
  const nsId = Bytes.fromUTF8 (ev.params.ns)
  const tokenId = tokenIdToBytes (ev.params.tokenId)
  const uniqueId = uniqueIdForEvent (ev)

  const mvEntity = new MoveEntity (uniqueId)
  mvEntity.tx = maybeCreateTransaction (ev)
  mvEntity.name = tokenId
  mvEntity.move = ev.params.mv
  mvEntity.save ()

  if (ev.params.receiver != Address.zero ())
    {
      const payment = new PaymentEntity (uniqueId)
      payment.move = mvEntity.id
      payment.receiver = ev.params.receiver
      payment.amount = ev.params.amount
      payment.save ()
    }

  if (ev.params.ns == "p")
    {
      const games = getPlayerMoveGames (ev.params.mv)
      for (let i = 0; i < games.length; ++i)
        {
          const gid = maybeCreateGame (games[i]);

          const gmvId = uniqueId.concat (gid)
          const gmvEntity = new GameMoveEntity (gmvId)
          gmvEntity.move = mvEntity.id
          gmvEntity.tx = mvEntity.tx
          gmvEntity.game = gid
          gmvEntity.save ()
        }
    }
}

export function handleRegistration (ev: RegistrationEvent): void
{
  maybeCreateAddress (ev.params.owner)

  const nsId = Bytes.fromUTF8 (ev.params.ns)
  if (NamespaceEntity.load (nsId) == null)
    {
      const nsEntity = new NamespaceEntity (nsId)
      nsEntity.ns = ev.params.ns
      nsEntity.save ()
    }

  const tokenId = tokenIdToBytes (ev.params.tokenId)
  const nameEntity = new NameEntity (tokenId)
  nameEntity.ns = nsId
  nameEntity.name = ev.params.name
  nameEntity.owner = ev.params.owner
  nameEntity.save ()

  const regEntity = new RegistrationEntity (uniqueIdForEvent (ev))
  regEntity.tx = maybeCreateTransaction (ev)
  regEntity.name = tokenId
  regEntity.save ()
}

export function handleTransfer (ev: TransferEvent): void
{
  maybeCreateAddress (ev.params.to)

  const tokenId = tokenIdToBytes (ev.params.tokenId)
  const nameEntity = NameEntity.load (tokenId)

  /* When a name is registered, it is minted first (which Transfer's from
     the zero address), and later the Registration event is emitted.  In this
     case the name does not exist.  Ignore that, as the registration handler
     will set the owner.  */
  if (nameEntity == null)
    return

  nameEntity.owner = ev.params.to
  nameEntity.save ()
}
