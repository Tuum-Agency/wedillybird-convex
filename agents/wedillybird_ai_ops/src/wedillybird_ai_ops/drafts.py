from __future__ import annotations

from datetime import date

from wedillybird_ai_ops.guardrails import APPROVAL_CHECKLIST, approval_blockers
from wedillybird_ai_ops.schemas import ApprovalGate, ContentPack, DayPlan, SeoBrief, SocialPost, WeeklyGrowthPlan


def default_week() -> str:
    today = date.today()
    iso = today.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def build_weekly_growth_plan(week: str, goal: str) -> WeeklyGrowthPlan:
    calendar = [
        DayPlan("Monday", "Instagram", "Reel draft", "Why wedding planning moved into WhatsApp"),
        DayPlan("Tuesday", "TikTok", "Video draft", "From spreadsheet chaos to one RSVP link"),
        DayPlan("Wednesday", "Instagram", "Story/slides", "Guest receives invite and confirms in seconds"),
        DayPlan("Thursday", "TikTok", "Video draft", "Wedding planners: branded RSVP and check-in stack"),
        DayPlan("Friday", "Instagram", "Reel draft", "What couples can prepare this weekend"),
        DayPlan("Saturday", "TikTok", "Video test", "Invitation, RSVP, QR check-in and gallery in one flow"),
        DayPlan("Sunday", "Ads", "Landing review", "Sharpen proof, FAQ and plan comparison before spend"),
    ]
    plan_text = "\n".join(day.angle for day in calendar)
    blockers = approval_blockers(plan_text)
    return WeeklyGrowthPlan(
        week=week,
        goal=goal,
        priorities=[
            "Clarify the launch offer for couples and wedding planners before driving traffic.",
            "Focus launch content and paid media on Instagram and TikTok only.",
            "Produce short vertical videos around WhatsApp-first invitations, RSVP and offline check-in.",
        ],
        content_calendar=calendar,
        experiments=[
            "A/B test two video hooks: 'Le mariage se vit dans la conversation' vs 'Invitations WhatsApp, RSVP et check-in en un seul lien'.",
            "Compare one TikTok problem/solution script against one Instagram product-flow Reel.",
        ],
        partnership_actions=[
            "Keep partnership outreach manual for now; do not allocate launch ad budget outside Instagram/TikTok.",
            "Prepare one short Instagram DM draft for wedding planners; do not send before human review.",
        ],
        landing_actions=[
            "Audit public stats and testimonials; mark every unsupported claim before launch.",
            "Add one clearer professional CTA toward the forfaits pros page if not already visible.",
        ],
        risks=[
            "Public claims in existing copy may need proof before paid acquisition.",
            "WhatsApp templates and production dependencies can block launch messaging.",
            "Do not use guest data or event data in marketing without explicit permission.",
        ],
        approval=ApprovalGate(checklist=APPROVAL_CHECKLIST, blockers=blockers),
    )


def _post(channel: str, title: str, body: str, cta: str) -> SocialPost:
    return SocialPost(
        channel=channel,
        title=title,
        body=body,
        cta=cta,
        guardrail_notes=approval_blockers(body),
    )


def build_content_pack(theme: str, audience: str) -> ContentPack:
    linkedin = [
        _post(
            "LinkedIn",
            "Le mariage ne se prepare plus dans un PDF",
            "Les invites ne cherchent pas une nouvelle app. Ils ouvrent WhatsApp, repondent, demandent l'adresse et partagent les photos. Wedillybird part de cette realite: une invitation claire, un RSVP simple et un check-in pret pour le jour J.",
            "A valider puis publier depuis le compte fondateur.",
        ),
        _post(
            "LinkedIn",
            "Le probleme cache des RSVP",
            "Le vrai sujet n'est pas seulement d'envoyer une belle invitation. C'est de savoir qui vient, qui vient accompagne, qui n'a pas repondu et ce qu'il faut relancer sans passer la semaine dans un tableur.",
            "A valider puis relier a la page guide.",
        ),
        _post(
            "LinkedIn",
            "Pour les wedding planners",
            "Un planner vend de la serenite. Sa stack doit suivre: branding agence, invitations propres, suivi RSVP, check-in QR et souvenirs apres l'evenement. C'est le role de Wedillybird cote operations.",
            "A valider puis adapter avec une offre pro.",
        ),
        _post(
            "LinkedIn",
            "Moins d'outils, plus de presence",
            "Un mariage demande deja assez de decisions. L'invitation, la reponse, l'entree et la galerie ne devraient pas devenir quatre outils differents pour les couples et leurs invites.",
            "A valider puis publier.",
        ),
        _post(
            "LinkedIn",
            "La promesse a garder simple",
            "Wedillybird ne remplace pas l'emotion du mariage. Il retire la friction autour: envoyer, suivre, accueillir, retrouver les souvenirs. Le couple reste au centre.",
            "A valider puis publier.",
        ),
    ]

    instagram = [
        _post("Instagram", "Votre invitation vit deja la ou vos invites parlent", "WhatsApp pour recevoir. Un lien pour repondre. Un QR code pour entrer. Une galerie pour revivre.", "Preparer mon mariage"),
        _post("Instagram", "Stop aux RSVP eparpilles", "Les reponses dans les messages, les appels, les mails et les groupes familiaux finissent toujours dans un tableur. Centralisez avant que ca deborde.", "Voir les forfaits"),
        _post("Instagram", "Jour J: l'entree doit rester fluide", "Le check-in QR aide l'equipe a accueillir les invites sans chercher une ligne dans une liste papier.", "Decouvrir Wedillybird"),
        _post("Instagram", "Pour les grands mariages", "Quand les familles, les amis et les invites accompagnes se melangent, le suivi doit rester lisible pour tout le monde.", "Demander une demo"),
        _post("Instagram", "Apres le mariage", "Les photos ne devraient pas disparaitre dans 15 conversations. Une galerie partagee garde les souvenirs au meme endroit.", "Voir Premium"),
    ]

    videos = [
        _post(
            "TikTok/Reels",
            "POV: tu geres les RSVP dans 6 groupes WhatsApp",
            "Plan: notifications partout. Cut: tableur ouvert. Cut: invite qui demande l'adresse. Fin: un seul lien Wedillybird avec RSVP et QR code.",
            "A valider puis tourner en format 20 secondes.",
        ),
        _post(
            "TikTok/Reels",
            "La difference entre une invitation jolie et une invitation utile",
            "Hook: une belle image ne suffit pas. Montrer: RSVP, accompagnants, QR code, galerie. Conclusion: l'invitation doit travailler pour le couple.",
            "A valider puis tourner.",
        ),
        _post(
            "TikTok/Reels",
            "Wedding planner: ce que tes couples ne voient pas",
            "Hook: ils voient la magie, pas les relances. Montrer: tableau RSVP, check-in, branding agence. Conclusion: une bonne stack protege ton temps.",
            "A valider puis tourner.",
        ),
    ]

    newsletter = """Bonjour,

Cette semaine, on prepare un sujet simple: l'invitation ne doit pas seulement etre belle, elle doit aider le couple a organiser.

Avec Wedillybird, l'invite recoit un lien, confirme sa presence, garde son QR code et retrouve la galerie apres le mariage. Le couple suit les reponses sans courir apres les messages.

Avant publication, cette newsletter doit etre relue pour verifier les offres, les prix et les preuves disponibles.
"""

    seo_briefs = [
        SeoBrief(
            title="Invitations mariage WhatsApp: le guide complet",
            intent="Informer les couples qui cherchent une alternative aux faire-part PDF, emails et groupes manuels.",
            outline=[
                "Pourquoi WhatsApp est devenu central dans l'organisation d'un mariage",
                "Ce qu'une invitation utile doit contenir",
                "Comment gerer RSVP, accompagnants et relances",
                "Check-in QR et galerie photo: preparer le jour J et l'apres",
            ],
            internal_links=["/", "/faq", "/templates", "/forfaits-pros"],
        ),
        SeoBrief(
            title="Logiciel RSVP mariage pour wedding planners",
            intent="Convertir les professionnels qui veulent gerer plusieurs mariages avec leur marque.",
            outline=[
                "Les limites des tableurs et formulaires generiques",
                "Branding agence et sous-domaine",
                "Suivi multi-evenements et quotas WhatsApp",
                "Comment presenter l'outil aux couples",
            ],
            internal_links=["/forfaits-pros", "/contact", "/guide"],
        ),
    ]

    all_text = "\n".join([post.body for post in linkedin + instagram + videos] + [newsletter])
    return ContentPack(
        theme=theme,
        audience=audience,
        linkedin_posts=linkedin,
        instagram_posts=instagram,
        short_video_scripts=videos,
        newsletter_subjects=[
            "Et si vos invitations arretaient de vivre dans un PDF ?",
            "RSVP, check-in, galerie: le trio qui calme le jour J",
            "Pourquoi Wedillybird part de WhatsApp",
        ],
        newsletter_body=newsletter,
        seo_briefs=seo_briefs,
        approval=ApprovalGate(checklist=APPROVAL_CHECKLIST, blockers=approval_blockers(all_text)),
    )
