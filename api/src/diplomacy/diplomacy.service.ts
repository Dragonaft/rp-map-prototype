import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Army } from '../armies/entities/army.entity';
import { Province } from '../provinces/entities/province.entity';
import { DEFENSIVE_BUILDING_TYPES } from '../actions/combat-calculator';
import { DiplomaticRelation } from './entities/diplomatic-relation.entity';
import { War } from './entities/war.entity';
import { WarParticipant } from './entities/war-participant.entity';
import { DiplomaticState, PEACE_DURATION_TURNS, WarSide, WarStatus, canonicalPair } from './types/diplomacy.types';

@Injectable()
export class DiplomacyService {
  constructor(
    @InjectRepository(DiplomaticRelation)
    private readonly relationRepo: Repository<DiplomaticRelation>,
    @InjectRepository(War)
    private readonly warRepo: Repository<War>,
  ) {}

  /** Default manager for read-only calls made outside a transaction (e.g. controller GETs). */
  get defaultManager(): EntityManager {
    return this.relationRepo.manager;
  }

  async findRelation(manager: EntityManager, userA: string, userB: string): Promise<DiplomaticRelation | null> {
    if (userA === userB) return null;
    const [a, b] = canonicalPair(userA, userB);
    return manager.findOne(DiplomaticRelation, { where: { user_a_id: a, user_b_id: b } });
  }

  async getOrCreateRelation(manager: EntityManager, userA: string, userB: string): Promise<DiplomaticRelation> {
    const [a, b] = canonicalPair(userA, userB);
    let relation = await manager.findOne(DiplomaticRelation, {
      where: { user_a_id: a, user_b_id: b },
      lock: { mode: 'pessimistic_write' },
    });
    if (!relation) {
      relation = await manager.save(DiplomaticRelation, manager.create(DiplomaticRelation, {
        user_a_id: a, user_b_id: b, state: DiplomaticState.NEUTRAL,
      }));
    }
    return relation;
  }

  async getState(manager: EntityManager, userA: string, userB: string): Promise<DiplomaticState> {
    const relation = await this.findRelation(manager, userA, userB);
    return relation?.state ?? DiplomaticState.NEUTRAL;
  }

  isHostileState(state: DiplomaticState): boolean {
    return state === DiplomaticState.NEUTRAL || state === DiplomaticState.WAR;
  }

  async isHostile(manager: EntityManager, userA: string, userB: string): Promise<boolean> {
    if (userA === userB) return false;
    return this.isHostileState(await this.getState(manager, userA, userB));
  }

  /** True if `owner` has granted `mover` permission to enter/cross its territory (alliance implies both directions). */
  async hasPassage(manager: EntityManager, moverId: string, ownerId: string): Promise<boolean> {
    if (moverId === ownerId) return true;
    const relation = await this.findRelation(manager, moverId, ownerId);
    if (!relation) return false;
    if (relation.state === DiplomaticState.ALLIANCE) return true;
    return relation.user_a_id === ownerId ? relation.pass_a_to_b : relation.pass_b_to_a;
  }

  async setState(manager: EntityManager, userA: string, userB: string, state: DiplomaticState): Promise<DiplomaticRelation> {
    const relation = await this.getOrCreateRelation(manager, userA, userB);
    relation.state = state;
    if (state === DiplomaticState.PEACE) relation.peace_turns = 0;
    await manager.save(DiplomaticRelation, relation);
    return relation;
  }

  async grantPass(manager: EntityManager, fromUserId: string, toUserId: string): Promise<void> {
    const relation = await this.getOrCreateRelation(manager, fromUserId, toUserId);
    if (relation.user_a_id === fromUserId) relation.pass_a_to_b = true;
    else relation.pass_b_to_a = true;
    await manager.save(DiplomaticRelation, relation);
  }

  async revokePass(manager: EntityManager, fromUserId: string, toUserId: string): Promise<void> {
    const relation = await this.findRelation(manager, fromUserId, toUserId);
    if (!relation) return;
    if (relation.user_a_id === fromUserId) relation.pass_a_to_b = false;
    else relation.pass_b_to_a = false;
    await manager.save(DiplomaticRelation, relation);
  }

  async setTrade(manager: EntityManager, userA: string, userB: string, hasTrade: boolean): Promise<void> {
    const relation = await this.getOrCreateRelation(manager, userA, userB);
    relation.has_trade = hasTrade;
    await manager.save(DiplomaticRelation, relation);
  }

  /** Normalized, per-other-player view of every relation involving `userId` (read-only, non-transactional). */
  async getRelationsForUser(userId: string): Promise<Array<{
    otherUserId: string; state: DiplomaticState; hasTrade: boolean; passToOther: boolean; passFromOther: boolean;
  }>> {
    const relations = await this.relationRepo.find({ where: [{ user_a_id: userId }, { user_b_id: userId }] });
    return relations.map((r) => {
      const isA = r.user_a_id === userId;
      return {
        otherUserId: isA ? r.user_b_id : r.user_a_id,
        state: r.state,
        hasTrade: r.has_trade,
        passToOther: isA ? r.pass_a_to_b : r.pass_b_to_a,
        passFromOther: isA ? r.pass_b_to_a : r.pass_a_to_b,
      };
    });
  }

  async getAlliesOf(manager: EntityManager, userId: string): Promise<string[]> {
    const relations = await manager.find(DiplomaticRelation, {
      where: [
        { user_a_id: userId, state: DiplomaticState.ALLIANCE },
        { user_b_id: userId, state: DiplomaticState.ALLIANCE },
      ],
    });
    return relations.map((r) => (r.user_a_id === userId ? r.user_b_id : r.user_a_id));
  }

  // ── Wars ────────────────────────────────────────────────────────────────

  async findActiveWarBetweenLeaders(manager: EntityManager, a: string, b: string): Promise<War | null> {
    return manager.findOne(War, {
      where: [
        { attacker_leader_id: a, defender_leader_id: b, status: WarStatus.ACTIVE },
        { attacker_leader_id: b, defender_leader_id: a, status: WarStatus.ACTIVE },
      ],
    });
  }

  /** Finds an active war where `leaderId` is a side leader and `participantId` is a non-leader member of the opposing side. */
  async findActiveWarWithOpposingParticipant(
    manager: EntityManager, leaderId: string, participantId: string,
  ): Promise<War | null> {
    const wars = await manager.find(War, {
      where: [
        { attacker_leader_id: leaderId, status: WarStatus.ACTIVE },
        { defender_leader_id: leaderId, status: WarStatus.ACTIVE },
      ],
      relations: ['participants'],
    });
    for (const war of wars) {
      const leaderSide = war.attacker_leader_id === leaderId ? WarSide.ATTACKER : WarSide.DEFENDER;
      const opposingSide = leaderSide === WarSide.ATTACKER ? WarSide.DEFENDER : WarSide.ATTACKER;
      const found = (war.participants ?? []).find(
        (p) => p.user_id === participantId && p.side === opposingSide && !p.is_leader,
      );
      if (found) return war;
    }
    return null;
  }

  async getWarsForUser(manager: EntityManager, userId: string): Promise<War[]> {
    const participantRows = await manager.find(WarParticipant, { where: { user_id: userId } });
    if (!participantRows.length) return [];
    return manager.find(War, { where: { id: In(participantRows.map((p) => p.war_id)) }, relations: ['participants'] });
  }

  /**
   * Starts a new war between two leaders (fresh WAR relation + War + two
   * leader WarParticipant rows), then calls the defender's allies to arms.
   */
  async startWar(manager: EntityManager, attackerId: string, defenderId: string): Promise<War> {
    await this.setState(manager, attackerId, defenderId, DiplomaticState.WAR);

    const war = await manager.save(War, manager.create(War, {
      attacker_leader_id: attackerId,
      defender_leader_id: defenderId,
      status: WarStatus.ACTIVE,
    }));
    await manager.save(WarParticipant, [
      manager.create(WarParticipant, { war_id: war.id, user_id: attackerId, side: WarSide.ATTACKER, is_leader: true }),
      manager.create(WarParticipant, { war_id: war.id, user_id: defenderId, side: WarSide.DEFENDER, is_leader: true }),
    ]);

    await this.callAllies(manager, war.id, defenderId, attackerId);
    return war;
  }

  /** Ensures the pair is at war (creating a War if one doesn't already exist), used whenever an occupation escalates a NEUTRAL relation. */
  async ensureWarBetween(manager: EntityManager, attackerId: string, victimId: string): Promise<void> {
    const state = await this.getState(manager, attackerId, victimId);
    if (state === DiplomaticState.WAR) return;
    await this.startWar(manager, attackerId, victimId);
  }

  /**
   * Calls every ally of `defenderId` (except the aggressor) to the defender's
   * side. An ally that is *also* allied to the aggressor breaks that alliance
   * first (and evacuates any now-illegally-parked armies on either side)
   * before joining the war against them.
   */
  async callAllies(manager: EntityManager, warId: string, defenderId: string, aggressorId: string): Promise<void> {
    const allies = await this.getAlliesOf(manager, defenderId);
    for (const allyId of allies) {
      if (allyId === aggressorId) continue;

      const allyVsAggressor = await this.getState(manager, allyId, aggressorId);
      if (allyVsAggressor === DiplomaticState.ALLIANCE) {
        await this.setState(manager, allyId, aggressorId, DiplomaticState.NEUTRAL);
        await this.evacuateForeignArmies(manager, allyId);
        await this.evacuateForeignArmies(manager, aggressorId);
      }

      if ((await this.getState(manager, allyId, aggressorId)) !== DiplomaticState.WAR) {
        await this.setState(manager, allyId, aggressorId, DiplomaticState.WAR);
      }

      const existing = await manager.findOne(WarParticipant, { where: { war_id: warId, user_id: allyId } });
      if (!existing) {
        await manager.save(WarParticipant, manager.create(WarParticipant, {
          war_id: warId, user_id: allyId, side: WarSide.DEFENDER, is_leader: false,
        }));
      }
    }
  }

  async leaveWar(manager: EntityManager, warId: string, userId: string): Promise<void> {
    await manager.delete(WarParticipant, { war_id: warId, user_id: userId });
  }

  async endWar(manager: EntityManager, warId: string): Promise<void> {
    await manager.update(War, warId, { status: WarStatus.ENDED });
  }

  /** PEACE relations decay to NEUTRAL after PEACE_DURATION_TURNS turns as an enforced truce. */
  async tickPeaceDecay(manager: EntityManager): Promise<void> {
    const peaceRelations = await manager.find(DiplomaticRelation, { where: { state: DiplomaticState.PEACE } });
    for (const relation of peaceRelations) {
      relation.peace_turns += 1;
      if (relation.peace_turns >= PEACE_DURATION_TURNS) {
        relation.state = DiplomaticState.NEUTRAL;
        relation.peace_turns = 0;
      }
      await manager.save(DiplomaticRelation, relation);
    }
  }

  // ── Movement / trade connectivity ─────────────────────────────────────────

  /**
   * Teleports every foreign army on `hostUserId`'s territory that is not at
   * war with them (i.e. present via an alliance or troops-pass that just got
   * cancelled) to its owner's nearest fort/capital-tier province, falling
   * back to the owner's nearest province of any kind. Armies whose owner
   * holds no provinces at all are left in place.
   */
  async evacuateForeignArmies(manager: EntityManager, hostUserId: string): Promise<void> {
    const hostProvinces = await manager.find(Province, { where: { user_id: hostUserId }, select: ['id'] });
    if (!hostProvinces.length) return;
    const hostProvinceIds = hostProvinces.map((p) => p.id);

    const armies = await manager.find(Army, { where: { province_id: In(hostProvinceIds) } });
    const foreignArmies: Army[] = [];
    for (const army of armies) {
      if (army.user_id === hostUserId) continue;
      if (await this.isHostile(manager, army.user_id, hostUserId)) continue;
      foreignArmies.push(army);
    }
    if (!foreignArmies.length) return;

    const allProvinces = await manager.find(Province, {
      relations: ['provinceBuildings', 'provinceBuildings.building'],
    });
    const byId = new Map(allProvinces.map((p) => [p.id, p]));

    for (const army of foreignArmies) {
      const destination = this.findEvacuationDestination(byId, army.user_id, army.province_id);
      if (destination && destination !== army.province_id) {
        army.province_id = destination;
        await manager.save(Army, army);
      }
    }
  }

  private findEvacuationDestination(byId: Map<string, Province>, ownerId: string, startId: string): string | null {
    const visited = new Set<string>([startId]);
    let frontier = [startId];
    let fallbackOwned: string | null = null;

    while (frontier.length) {
      const nextFrontier: string[] = [];
      for (const currentId of frontier) {
        const current = byId.get(currentId);
        if (!current) continue;

        if (current.user_id === ownerId) {
          const isFortTier = (current.buildings ?? []).some((b) => DEFENSIVE_BUILDING_TYPES.has(b.type));
          if (isFortTier) return current.id;
          if (!fallbackOwned) fallbackOwned = current.id;
        }

        for (const neighborId of current.neighbor_ids ?? []) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            nextFrontier.push(neighborId);
          }
        }
      }
      frontier = nextFrontier;
    }

    return fallbackOwned;
  }

  /**
   * True if `a` and `b` can trade goods/resources directly: they share a
   * border, or a chain of bordering intermediates connects them where every
   * intermediate has granted troops-pass to at least one of the two traders.
   */
  async tradeConnected(manager: EntityManager, a: string, b: string): Promise<boolean> {
    if (a === b) return true;

    const provinces = await manager.find(Province, { select: ['id', 'user_id', 'neighbor_ids'] });
    const ownerOf = new Map<string, string>();
    for (const p of provinces) if (p.user_id) ownerOf.set(p.id, p.user_id);

    const borderEdges = new Map<string, Set<string>>();
    const addEdge = (x: string, y: string) => {
      if (!borderEdges.has(x)) borderEdges.set(x, new Set());
      borderEdges.get(x).add(y);
    };
    for (const p of provinces) {
      const ownerX = ownerOf.get(p.id);
      if (!ownerX) continue;
      for (const neighborId of p.neighbor_ids ?? []) {
        const ownerY = ownerOf.get(neighborId);
        if (ownerY && ownerY !== ownerX) addEdge(ownerX, ownerY);
      }
    }

    const visited = new Set<string>([a]);
    let frontier = [a];
    while (frontier.length) {
      const nextFrontier: string[] = [];
      for (const x of frontier) {
        for (const y of borderEdges.get(x) ?? []) {
          if (visited.has(y)) continue;
          if (y === b) return true;

          const grantedToA = await this.hasPassage(manager, a, y);
          const grantedToB = await this.hasPassage(manager, b, y);
          if (!grantedToA && !grantedToB) continue;

          visited.add(y);
          nextFrontier.push(y);
        }
      }
      frontier = nextFrontier;
    }
    return false;
  }
}
