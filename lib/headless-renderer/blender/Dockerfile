FROM varg/blender-docker:latest

ARG SERVICE_DIRECTORY="/opt/blender-render-service"

ENV LANG=C
ENV LANGUAGE=C
ENV LC_ALL=C

# Basics
RUN DEBIAN_FRONTEND=noninteractive apt install -y python3 python3-dev python3-pip
RUN python3 -m pip install pipenv

# Service
WORKDIR ${SERVICE_DIRECTORY}

ADD fastapi-server ${SERVICE_DIRECTORY}
RUN pipenv install

CMD ["pipenv", "run", "uvicorn", "--bind", "0.0.0.0", "run_server:app", "-k", "uvicorn.workers.UvicornWorker"]
