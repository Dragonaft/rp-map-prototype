import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Province } from '../provinces/entities/province.entity';
import { UserResourcesService } from '../resources/user-resources.service';
import { UserGoodsService } from '../goods/user-goods.service';
import { Treaty } from './entities/treaty.entity';
import { WarParticipant } from './entities/war-participant.entity';
import { DiplomacyService } from './diplomacy.service';
import { OccupationService } from './occupation.service';
import {
  DiplomaticState,
  PeaceScope,
  TREATY_EXPIRY_TURNS,
  TreatyArticle,
  TreatyKind,
  TreatyStatus,
  TreatyVisibility,
  WarSide,
} from './types/diplomacy.types';
import { ProposeTreatyDto } from './dto/propose-treaty.dto';

@Injectable()
export class TreatyService {
  constructor(
    @InjectRepository(Treaty)
    private readonly treatyRepo: Repository<Treaty>,
    private readonly diplomacyService: DiplomacyService,
    private readonly occupationService: OccupationService,
    private readonly userResourcesService: UserResourcesService,
    private readonly userGoodsService: UserGoodsService,
  ) {}

  get defaultManager(): EntityManager {
    return this.treatyRepo.manager;
  }

  async getMyTreaties(userId: string): Promise<Treaty[]> {
    return this.treatyRepo.find({
      where: [{ proposer_id: userId }, { receiver_id: userId }],
      order: { createdAt: 'DESC' },
    });
  }

  async getPublicTreaties(userId: string): Promise<Treaty[]> {
    return this.treatyRepo.find({
      where: [
        { proposer_id: userId, status: TreatyStatus.ACCEPTED, visibility: TreatyVisibility.PUBLIC },
        { receiver_id: userId, status: TreatyStatus.ACCEPTED, visibility: TreatyVisibility.PUBLIC },
      ],
      order: { createdAt: 'DESC' },
    });
  }

  // ── Propose ────────────────────────────────────────────────────────────

  async proposeTreaty(manager: EntityManager, proposerId: string, dto: ProposeTreatyDto): Promise<Treaty> {
    const { name, receiverId, kind, peaceScope, visibility, recurring, articles, note } = dto;
    if (proposerId === receiverId) throw new Error('Cannot propose a treaty to yourself');

    switch (kind) {
      case TreatyKind.PEACE: {
        if (!peaceScope) throw new Error('peaceScope is required for a peace treaty');
        if (peaceScope === PeaceScope.LEADER) {
          const war = await this.diplomacyService.findActiveWarBetweenLeaders(manager, proposerId, receiverId);
          if (!war) throw new Error('No active war between these two war leaders');
        } else {
          const war = await this.diplomacyService.findActiveWarWithOpposingParticipant(manager, proposerId, receiverId);
          if (!war) throw new Error('Receiver is not an opposing non-leader participant in your war');
        }
        await this.validatePeaceArticles(manager, proposerId, receiverId, peaceScope, articles);
        break;
      }
      case TreatyKind.ALLIANCE: {
        const state = await this.diplomacyService.getState(manager, proposerId, receiverId);
        if (state === DiplomaticState.WAR) {
          throw new Error('Cannot propose an alliance while at war — make peace first');
        }
        break;
      }
      case TreatyKind.TRADE: {
        const tradeState = await this.diplomacyService.getState(manager, proposerId, receiverId);
        if (tradeState === DiplomaticState.WAR) {
          throw new Error('Cannot propose a trade while at war — make peace first');
        }
        for (const article of articles) {
          if (article.type === 'resource_tribute' || article.type === 'goods_tribute') {
            const connected = await this.diplomacyService.tradeConnected(manager, proposerId, receiverId);
            if (!connected) {
              throw new Error('Players must share a border, or a troops-pass route through intermediates, to trade goods/resources');
            }
          }
        }
        break;
      }
      case TreatyKind.TROOPS_PASS: {
        if (!articles.some((a) => a.type === 'grant_pass')) {
          throw new Error('A troops-pass treaty needs a grant_pass article');
        }
        const passState = await this.diplomacyService.getState(manager, proposerId, receiverId);
        if (passState === DiplomaticState.WAR) {
          throw new Error('Cannot propose troops pass while at war — make peace first');
        }
        break;
      }
      case TreatyKind.ARTICLE: {
        if (!note?.trim()) throw new Error('An article treaty needs note text');
        break;
      }
      default:
        throw new Error('Unknown treaty kind');
    }

    const treaty = manager.create(Treaty, {
      name,
      proposer_id: proposerId,
      receiver_id: receiverId,
      kind,
      peace_scope: kind === TreatyKind.PEACE ? peaceScope : null,
      visibility: visibility ?? TreatyVisibility.PRIVATE,
      recurring: kind === TreatyKind.TRADE ? !!recurring : false,
      status: TreatyStatus.PENDING,
      articles,
      note: note ?? null,
    });
    return manager.save(Treaty, treaty);
  }

  private async validatePeaceArticles(
    manager: EntityManager, proposerId: string, receiverId: string, scope: PeaceScope, articles: TreatyArticle[],
  ): Promise<void> {
    const cedeArticles = articles.filter((a): a is Extract<TreatyArticle, { type: 'cede_province' }> => a.type === 'cede_province');
    if (!cedeArticles.length) return;

    const provinceIds = cedeArticles.map((a) => a.provinceId);
    const provinces = await manager.find(Province, { where: { id: In(provinceIds) } });
    if (provinces.length !== new Set(provinceIds).size) throw new Error('One or more demanded provinces were not found');
    const provinceById = new Map(provinces.map((p) => [p.id, p]));

    if (scope === PeaceScope.SEPARATE) {
      for (const article of cedeArticles) {
        const province = provinceById.get(article.provinceId);
        if (!province || province.user_id !== receiverId || province.occupier_id !== proposerId) {
          throw new Error('A separate peace may only cede provinces the enemy ally owns and you currently occupy');
        }
      }
    } else {
      for (const article of cedeArticles) {
        const province = provinceById.get(article.provinceId);
        if (!province || province.user_id !== article.from) {
          throw new Error(`Province ${article.provinceId} is not owned by the stated 'from' party`);
        }
      }
    }

    const cededByReceiver = new Map<string, Province[]>();
    for (const article of cedeArticles) {
      const province = provinceById.get(article.provinceId);
      const list = cededByReceiver.get(article.to) ?? [];
      list.push(province);
      cededByReceiver.set(article.to, list);
    }
    for (const [toUserId, cededList] of cededByReceiver) {
      const owned = await manager.find(Province, { where: { user_id: toUserId }, select: ['id'] });
      const ownedIds = new Set(owned.map((p) => p.id));
      if (!this.isContiguous(cededList, ownedIds)) {
        throw new Error(`Demanded provinces for ${toUserId} are not contiguous to their existing territory`);
      }
    }
  }

  /** EU4-style contiguity: every ceded province must connect (directly or through another ceded province) to the receiver's existing territory. */
  private isContiguous(cededProvinces: Province[], receiverOwnedIds: Set<string>): boolean {
    const cededById = new Map(cededProvinces.map((p) => [p.id, p]));
    const connected = new Set(receiverOwnedIds);
    const pending = new Set(cededById.keys());

    let changed = true;
    while (changed) {
      changed = false;
      for (const id of Array.from(pending)) {
        const province = cededById.get(id);
        if ((province.neighbor_ids ?? []).some((n) => connected.has(n))) {
          connected.add(id);
          pending.delete(id);
          changed = true;
        }
      }
    }
    return pending.size === 0;
  }

  // ── Respond ────────────────────────────────────────────────────────────

  async acceptTreaty(manager: EntityManager, userId: string, treatyId: string): Promise<Treaty> {
    const treaty = await manager.findOne(Treaty, { where: { id: treatyId }, lock: { mode: 'pessimistic_write' } });
    if (!treaty) throw new Error('Treaty not found');
    if (treaty.view_only) throw new Error('This proposal is view-only for you');
    if (treaty.receiver_id !== userId) throw new Error('Only the receiver can accept this treaty');
    if (treaty.status !== TreatyStatus.PENDING) throw new Error('Treaty is no longer pending');

    if (treaty.kind === TreatyKind.PEACE) {
      if (treaty.peace_scope === PeaceScope.LEADER) {
        const war = await this.diplomacyService.findActiveWarBetweenLeaders(manager, treaty.proposer_id, treaty.receiver_id);
        if (!war) throw new Error('War is no longer active between these leaders');
      } else {
        const war = await this.diplomacyService.findActiveWarWithOpposingParticipant(manager, treaty.proposer_id, treaty.receiver_id);
        if (!war) throw new Error('You are no longer an opposing participant in this war');
      }
    }

    await this.applyArticles(manager, treaty);
    if (treaty.kind === TreatyKind.PEACE) {
      await this.resolvePeaceWar(manager, treaty);
    }

    treaty.status = TreatyStatus.ACCEPTED;
    treaty.resolved_at = new Date();
    await manager.save(Treaty, treaty);

    await this.cancelStaleCounterProposals(manager, treaty);
    return treaty;
  }

  async rejectTreaty(manager: EntityManager, userId: string, treatyId: string): Promise<Treaty> {
    const treaty = await manager.findOne(Treaty, { where: { id: treatyId } });
    if (!treaty) throw new Error('Treaty not found');
    if (treaty.view_only) throw new Error('This proposal is view-only for you');
    if (treaty.receiver_id !== userId) throw new Error('Only the receiver can reject this treaty');
    if (treaty.status !== TreatyStatus.PENDING) throw new Error('Treaty is no longer pending');
    treaty.status = TreatyStatus.REJECTED;
    treaty.resolved_at = new Date();
    return manager.save(Treaty, treaty);
  }

  async cancelPendingProposal(manager: EntityManager, userId: string, treatyId: string): Promise<Treaty> {
    const treaty = await manager.findOne(Treaty, { where: { id: treatyId } });
    if (!treaty) throw new Error('Treaty not found');
    if (treaty.proposer_id !== userId) throw new Error('Only the proposer can cancel this proposal');
    if (treaty.status !== TreatyStatus.PENDING) throw new Error('Treaty is no longer pending');
    treaty.status = TreatyStatus.CANCELLED;
    treaty.resolved_at = new Date();
    return manager.save(Treaty, treaty);
  }

  /** Cancels a previously-accepted alliance or troops-pass treaty (either signatory may do this at any time). */
  async cancelSignedTreaty(manager: EntityManager, userId: string, treatyId: string): Promise<Treaty> {
    const treaty = await manager.findOne(Treaty, { where: { id: treatyId }, lock: { mode: 'pessimistic_write' } });
    if (!treaty) throw new Error('Treaty not found');
    if (treaty.proposer_id !== userId && treaty.receiver_id !== userId) throw new Error('Not a party to this treaty');
    if (treaty.status !== TreatyStatus.ACCEPTED) throw new Error('Treaty is not an active signed treaty');
    if (treaty.kind !== TreatyKind.ALLIANCE && treaty.kind !== TreatyKind.TROOPS_PASS) {
      throw new Error('Only alliance and troops-pass treaties can be cancelled after signing');
    }

    if (treaty.kind === TreatyKind.ALLIANCE) {
      await this.diplomacyService.setState(manager, treaty.proposer_id, treaty.receiver_id, DiplomaticState.NEUTRAL);
    } else {
      const grant = treaty.articles.find((a) => a.type === 'grant_pass') as Extract<TreatyArticle, { type: 'grant_pass' }> | undefined;
      if (grant) await this.diplomacyService.revokePass(manager, grant.from, grant.to);
    }

    treaty.status = TreatyStatus.CANCELLED;
    treaty.resolved_at = new Date();
    await manager.save(Treaty, treaty);

    await this.diplomacyService.evacuateForeignArmies(manager, treaty.proposer_id);
    await this.diplomacyService.evacuateForeignArmies(manager, treaty.receiver_id);
    return treaty;
  }

  async declareWar(manager: EntityManager, attackerId: string, targetId: string): Promise<void> {
    if (attackerId === targetId) throw new Error('Cannot declare war on yourself');
    const state = await this.diplomacyService.getState(manager, attackerId, targetId);
    if (state === DiplomaticState.ALLIANCE) throw new Error('Cannot attack an ally — break the alliance first');
    if (state === DiplomaticState.WAR) throw new Error('Already at war');
    if (state === DiplomaticState.PEACE) throw new Error('Cannot declare war during an enforced peace truce');

    await this.cancelPendingBetween(manager, attackerId, targetId, [TreatyKind.PEACE, TreatyKind.ALLIANCE]);
    await this.diplomacyService.startWar(manager, attackerId, targetId);
  }

  async sendMoney(manager: EntityManager, fromUserId: string, toUserId: string, amount: number): Promise<void> {
    if (fromUserId === toUserId) throw new Error('Cannot send money to yourself');
    const state = await this.diplomacyService.getState(manager, fromUserId, toUserId);
    if (state === DiplomaticState.WAR) {
      throw new Error('Cannot send money while at war — make peace first');
    }
    const fromUser = await manager.findOne(User, { where: { id: fromUserId }, lock: { mode: 'pessimistic_write' } });
    if (!fromUser || (fromUser.money ?? 0) < amount) throw new Error('Insufficient funds');
    const toUser = await manager.findOne(User, { where: { id: toUserId }, lock: { mode: 'pessimistic_write' } });
    if (!toUser) throw new Error('Recipient not found');

    fromUser.money = (fromUser.money ?? 0) - amount;
    toUser.money = (toUser.money ?? 0) + amount;
    await manager.save(User, [fromUser, toUser]);
  }

  // ── Turn processing (called from the scheduler) ───────────────────────────

  /** Re-applies every accepted recurring trade treaty's transfer articles; a side that can't pay just skips that turn. */
  async processRecurringTrades(manager: EntityManager): Promise<void> {
    const treaties = await manager.find(Treaty, {
      where: { kind: TreatyKind.TRADE, recurring: true, status: TreatyStatus.ACCEPTED },
    });
    for (const treaty of treaties) {
      for (const article of treaty.articles) {
        await this.applyTransferArticle(manager, article);
      }
    }
  }

  /**
   * Bankruptcy fallout: cancels every accepted recurring trade treaty where this user is the
   * `from` side of a money_tribute article — they can no longer afford to keep paying it out.
   * Returns the number of treaties cancelled.
   */
  async cancelOutgoingRecurringMoneyTrades(manager: EntityManager, userId: string): Promise<number> {
    const treaties = await manager.find(Treaty, {
      where: { kind: TreatyKind.TRADE, recurring: true, status: TreatyStatus.ACCEPTED },
    });
    let cancelled = 0;
    for (const treaty of treaties) {
      const sendsMoney = treaty.articles.some((a) => a.type === 'money_tribute' && a.from === userId);
      if (!sendsMoney) continue;
      treaty.status = TreatyStatus.CANCELLED;
      treaty.resolved_at = new Date();
      await manager.save(Treaty, treaty);
      cancelled++;
    }
    return cancelled;
  }

  /** Pending proposals older than TREATY_EXPIRY_TURNS auto-reject. */
  async tickPendingExpiry(manager: EntityManager): Promise<void> {
    const pending = await manager.find(Treaty, { where: { status: TreatyStatus.PENDING } });
    for (const treaty of pending) {
      treaty.pending_turns += 1;
      if (treaty.pending_turns >= TREATY_EXPIRY_TURNS) {
        treaty.status = TreatyStatus.REJECTED;
        treaty.resolved_at = new Date();
      }
      await manager.save(Treaty, treaty);
    }
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private async applyArticles(manager: EntityManager, treaty: Treaty): Promise<void> {
    for (const article of treaty.articles) {
      switch (article.type) {
        case 'cede_province': {
          const province = await manager.findOne(Province, {
            where: { id: article.provinceId },
            relations: ['provinceBuildings', 'provinceBuildings.building'],
            lock: { mode: 'pessimistic_write' },
          });
          if (province) await this.occupationService.coreProvince(manager, province, article.to);
          break;
        }
        case 'set_state':
          await this.diplomacyService.setState(manager, treaty.proposer_id, treaty.receiver_id, article.state);
          break;
        case 'grant_pass':
          await this.diplomacyService.grantPass(manager, article.from, article.to);
          break;
        case 'trade_agreement':
          await this.diplomacyService.setTrade(manager, treaty.proposer_id, treaty.receiver_id, true);
          break;
        case 'text':
          break; // pure RP article, no mechanical effect
        default:
          await this.applyTransferArticle(manager, article);
      }
    }
  }

  private async applyTransferArticle(manager: EntityManager, article: TreatyArticle): Promise<void> {
    if (article.type === 'money_tribute') {
      const fromUser = await manager.findOne(User, { where: { id: article.from }, lock: { mode: 'pessimistic_write' } });
      const toUser = await manager.findOne(User, { where: { id: article.to }, lock: { mode: 'pessimistic_write' } });
      if (!fromUser || !toUser) return;
      // Clamped to >= 0: a negative balance (allowed since money can go into debt) means nothing payable, not a negative transfer to the recipient.
      const payable = Math.max(0, Math.min(fromUser.money ?? 0, article.amount));
      fromUser.money = (fromUser.money ?? 0) - payable;
      toUser.money = (toUser.money ?? 0) + payable;
      await manager.save(User, [fromUser, toUser]);
    } else if (article.type === 'resource_tribute') {
      const reserved = await this.userResourcesService.tryReserve(manager, article.from, article.resourceKey, article.amount);
      if (reserved.ok) await this.userResourcesService.adjustQuantity(manager, article.to, article.resourceKey, article.amount);
    } else if (article.type === 'goods_tribute') {
      const reserved = await this.userGoodsService.tryReserve(manager, article.from, article.goodId, article.amount);
      if (reserved.ok) await this.userGoodsService.adjustQuantity(manager, article.to, article.goodId, article.amount);
    }
  }

  private async returnNonCededOccupations(manager: EntityManager, userA: string, userB: string): Promise<void> {
    const stillOccupied = await manager.find(Province, {
      where: [
        { user_id: userA, occupier_id: userB },
        { user_id: userB, occupier_id: userA },
      ],
    });
    for (const province of stillOccupied) {
      await this.occupationService.clearOccupation(manager, province);
    }
  }

  private async resolvePeaceWar(manager: EntityManager, treaty: Treaty): Promise<void> {
    if (treaty.peace_scope === PeaceScope.LEADER) {
      const war = await this.diplomacyService.findActiveWarBetweenLeaders(manager, treaty.proposer_id, treaty.receiver_id);
      if (!war) return;

      const participants = war.participants ?? await manager.find(WarParticipant, { where: { war_id: war.id } });
      const attackers = participants.filter((p) => p.side === WarSide.ATTACKER);
      const defenders = participants.filter((p) => p.side === WarSide.DEFENDER);

      for (const atk of attackers) {
        for (const def of defenders) {
          await this.diplomacyService.setState(manager, atk.user_id, def.user_id, DiplomaticState.PEACE);
          await this.returnNonCededOccupations(manager, atk.user_id, def.user_id);
        }
      }
      await this.diplomacyService.endWar(manager, war.id);

      // Non-leader allies get a read-only copy of the settled terms.
      const allies = participants.filter((p) => !p.is_leader);
      for (const ally of allies) {
        await this.treatyRepo.save(this.treatyRepo.create({
          name: treaty.name,
          proposer_id: treaty.proposer_id,
          receiver_id: ally.user_id,
          kind: TreatyKind.PEACE,
          peace_scope: PeaceScope.LEADER,
          visibility: treaty.visibility,
          status: TreatyStatus.ACCEPTED,
          articles: treaty.articles,
          note: treaty.note,
          view_only: true,
          resolved_at: new Date(),
        }));
      }
    } else {
      const war = await this.diplomacyService.findActiveWarWithOpposingParticipant(manager, treaty.proposer_id, treaty.receiver_id);
      if (!war) return;

      const receiverSide = war.attacker_leader_id === treaty.proposer_id ? WarSide.DEFENDER : WarSide.ATTACKER;
      const receiverLeaderId = receiverSide === WarSide.ATTACKER ? war.attacker_leader_id : war.defender_leader_id;

      await this.diplomacyService.leaveWar(manager, war.id, treaty.receiver_id);
      await this.diplomacyService.setState(manager, treaty.proposer_id, treaty.receiver_id, DiplomaticState.PEACE);
      await this.returnNonCededOccupations(manager, treaty.proposer_id, treaty.receiver_id);

      if (receiverLeaderId && receiverLeaderId !== treaty.receiver_id) {
        await this.diplomacyService.setState(manager, treaty.receiver_id, receiverLeaderId, DiplomaticState.NEUTRAL);
      }
    }
  }

  private async cancelPendingBetween(manager: EntityManager, a: string, b: string, kinds: TreatyKind[]): Promise<void> {
    const pending = await manager.find(Treaty, {
      where: [
        { proposer_id: a, receiver_id: b, status: TreatyStatus.PENDING },
        { proposer_id: b, receiver_id: a, status: TreatyStatus.PENDING },
      ],
    });
    for (const treaty of pending) {
      if (!kinds.includes(treaty.kind)) continue;
      treaty.status = TreatyStatus.CANCELLED;
      treaty.resolved_at = new Date();
      await manager.save(Treaty, treaty);
    }
  }

  private async cancelStaleCounterProposals(manager: EntityManager, accepted: Treaty): Promise<void> {
    const stale = await manager.find(Treaty, {
      where: [
        { proposer_id: accepted.proposer_id, receiver_id: accepted.receiver_id, kind: accepted.kind, status: TreatyStatus.PENDING },
        { proposer_id: accepted.receiver_id, receiver_id: accepted.proposer_id, kind: accepted.kind, status: TreatyStatus.PENDING },
      ],
    });
    for (const treaty of stale) {
      if (treaty.id === accepted.id) continue;
      treaty.status = TreatyStatus.CANCELLED;
      treaty.resolved_at = new Date();
      await manager.save(Treaty, treaty);
    }
  }
}
