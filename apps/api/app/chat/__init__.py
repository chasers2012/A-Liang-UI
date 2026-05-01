from app.chat.agents.skills import register_chat_agent_skills

from .config import register_llm_settings_module

register_llm_settings_module()
register_chat_agent_skills()
