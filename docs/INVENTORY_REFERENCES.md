# Inventory references and compact sheets

Character output enriches saved equipment from the pinned local SRD equipment
and magic-item snapshots. This applies to owner sheets, assigned player sheets,
and Dungeon Master's Vault import previews. Existing inventories do not need a
new import. Identifiers, quantities, equipped state, custom descriptions, and
explicit weapon/armour profiles are preserved. Different canonical rules remain
available as reference text beside custom descriptions.

Names can identify a concrete base form and a magic-item family (for example,
`Sword Of Wounding Longsword` resolves to `longsword` and `sword-of-wounding`).
Ambiguous generic swords/armour are not assigned an arbitrary base form. Only
explicit unconditional enchantment bonuses enter attack/armour calculations;
conditional effects and requirements are shown in full rules text.

Combat derives attacks from equipped weapons, reuses matching entered attacks,
and keeps independent custom attacks. Unequipping an inventory weapon removes
its attack from Combat without deleting its saved rules or custom attack data.
Players still submit only allowed quantity/equipped changes; item rules resolve
on the server and cannot be replaced through a player play update.

Inventory names and equipped Combat attacks expand to show rules and effects.
Creation inventory and link-import preview use the same renderer. Spell repair
is under Spell options / Manage spell definitions and in the spell editor,
instead of being repeated beside spell descriptions.

Workspaces have narrower centred maximum widths, with tighter nested cards and
forms. Mobile layouts and the user's independent feature columns are retained.
